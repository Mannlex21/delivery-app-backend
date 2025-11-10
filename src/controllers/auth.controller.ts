// src/controllers/auth.controller.ts

import { Request, Response } from "express";
import { Types } from "mongoose"; // Necesario para tipar correctamente los IDs
import User, { IUser } from "../models/User.model.js";
import {
	createToken,
	generateRefreshToken,
	getUserInfoById,
} from "../utils/auth.utils.js";

// --- Función Auxiliar ---

// --- Controladores de Autenticación ---

/**
 * Registra un nuevo usuario (cliente por defecto).
 */
export const register = async (req: Request, res: Response) => {
	try {
		const { email, password, name, phone, role } = req.body;

		// 1. Verificación básica de existencia
		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res
				.status(409)
				.json({ message: "El correo ya está registrado." });
		}

		// ... (creación y guardado del usuario)
		const user = new User({
			email,
			password,
			name,
			phone,
			role: role || "client",
		});
		await user.save();

		// 3. Emitir token y responder
		// Hacemos un cast de user._id a Types.ObjectId para satisfacer al linter
		const userIdAsObjectId = user._id as Types.ObjectId;
		const token = createToken(userIdAsObjectId);
		const refreshToken = await generateRefreshToken(user);

		// Evitamos enviar la contraseña al frontend
		res.status(200).json({
			token,
			refreshToken,
			user: {
				_id: user._id,
				name: user.name,
				role: user.role,
				email: user.email,
			},
		});
	} catch (error) {
		console.error("Error en el registro de usuario:", error);
		res.status(500).json({ message: "Error interno del servidor." });
	}
};

/**
 * Inicia sesión para un usuario existente.
 */
export const login = async (req: Request, res: Response) => {
	try {
		const { email, password } = req.body;

		// 1. Buscar el usuario.
		const user = await User.findOne({ email }).select("+password");

		if (!user) {
			return res.status(401).json({ message: "Credenciales inválidas." });
		}

		// Asignamos el tipo IUser al resultado de la consulta para tipar el _id
		const typedUser = user as IUser;

		// 2. Comparar contraseñas
		// Se llama al método comparePassword del objeto ya tipado (typedUser)
		const isMatch = await typedUser.comparePassword(password);
		if (!isMatch) {
			return res.status(401).json({ message: "Credenciales inválidas." });
		}

		// 3. Emitir token y responder

		// ¡USAR DIRECTAMENTE typedUser._id!
		// typedUser._id ya es reconocido como Types.ObjectId por el cast a IUser.
		const userIdAsObjectId = user._id as Types.ObjectId;
		const token = createToken(userIdAsObjectId);
		const refreshToken = await generateRefreshToken(user);

		// Note: La propiedad 'password' no existe en 'user' porque usamos .select('+password')
		// que solo la trae para esta consulta, pero la interfaz general la excluye.
		res.status(200).json({
			token,
			refreshToken,
			user: {
				_id: user._id,
				name: user.name,
				role: user.role,
				email: user.email,
			},
		});
	} catch (error) {
		console.error("Error en el login de usuario:", error);
		res.status(500).json({ message: "Error interno del servidor." });
	}
};

/**
 * [POST /auth/logout] Elimina el Refresh Token de la base de datos.
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
	// 💡 IMPORTANTE: El frontend DEBE enviar el refreshToken en el body
	const { refreshToken } = req.body;

	if (!refreshToken) {
		res.status(400).json({
			message: "Refresh Token necesario para la revocación.",
		});
		return;
	}

	try {
		const user = await User.findOne({
			"refreshTokens.token": refreshToken,
		});

		if (user) {
			// Eliminar el token del array del usuario
			user.refreshTokens = user.refreshTokens.filter(
				(t) => t.token !== refreshToken
			);
			await user.save();
		}

		// Siempre respondemos con éxito (200 o 204) para evitar que un atacante sepa si el token existe
		res.status(200).send();
	} catch (error) {
		console.error("Error al revocar token:", error);
		res.status(500).json({ message: "Error interno del servidor." });
	}
};

/**
 * [POST /auth/refresh-token] Renueva el Access Token usando un Refresh Token de larga duración.
 */
export const refreshToken = async (
	req: Request,
	res: Response
): Promise<void> => {
	const { refreshToken: clientRefreshToken } = req.body;

	if (!clientRefreshToken) {
		res.status(401).json({ message: "Refresh Token requerido." });
		return;
	}

	try {
		// 1. Buscar el usuario que tiene este Refresh Token
		const user = await User.findOne({
			"refreshTokens.token": clientRefreshToken,
		});

		if (!user) {
			// El token no existe en nuestra DB
			res.status(403).json({
				message: "Token de refresco inválido o no encontrado.",
			});
			return;
		}

		// 2. Encontrar el token específico y verificar expiración
		const storedToken = user.refreshTokens.find(
			(t) => t.token === clientRefreshToken
		);

		if (!storedToken || storedToken.expiresAt.getTime() < Date.now()) {
			// Limpiar el token expirado de la DB
			if (storedToken) {
				user.refreshTokens = user.refreshTokens.filter(
					(t) => t.token !== clientRefreshToken
				);
				await user.save();
			}
			res.status(403).json({
				message:
					"Token de refresco expirado. Por favor, inicie sesión de nuevo.",
			});
			return;
		}

		// 3. Si el token es válido: generar nuevo Access Token y rotar el Refresh Token

		// a) Generar el nuevo Access Token
		const userIdAsObjectId = user._id as Types.ObjectId;
		const token = createToken(userIdAsObjectId);

		// b) Opcional: ROTAR el Refresh Token (Mejora la seguridad)
		// Eliminamos el token viejo
		user.refreshTokens = user.refreshTokens.filter(
			(t) => t.token !== clientRefreshToken
		);
		// Generamos uno nuevo y lo guardamos en la DB
		const refreshToken = await generateRefreshToken(user);

		// 4. Responder con los nuevos tokens
		res.status(200).json({
			token,
			refreshToken, // Devolvemos el nuevo RT si rotamos
			message: "Tokens renovados exitosamente.",
		});
	} catch (error) {
		console.error("Error al renovar token:", error);
		res.status(500).json({
			message: "Error interno del servidor al renovar token.",
		});
	}
};

// Interfaz que tu middleware usa para inyectar datos en req
interface AuthRequest extends Request {
	user?: { userId: string };
}

/**
 * [GET /auth/me] Obtiene el perfil completo del usuario logueado.
 */
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const userId = req.user?.userId;
		// Busca al usuario por su ID
		// Usamos .select('-password') para asegurarnos de que el hash de la contraseña nunca se envíe
		const user = await getUserInfoById(userId);

		if (!user) {
			res.status(404).json({
				message: "Perfil de usuario no encontrado.",
			});
			return;
		}

		res.status(200).json(user);
	} catch (error) {
		console.error("Error al obtener perfil:", error);
		res.status(500).json({ message: "Error interno del servidor." });
	}
};
