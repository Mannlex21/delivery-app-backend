// src/middleware/auth.middleware.ts

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";

// Extendemos la interfaz Request de Express para añadir el campo 'user'
// Esto permite que TypeScript sepa que 'req.user' existe después del middleware
// En un proyecto real, esto se definiría en un archivo de tipos global (ej: @types/express/index.d.ts)
declare module "express" {
	export interface Request {
		user?: { userId: string }; // Puedes añadir más campos como 'role' (cliente, repartidor) aquí
	}
}

/**
 * Middleware para verificar la autenticación del usuario mediante JWT.
 * * @param req La petición de Express.
 * @param res La respuesta de Express.
 * @param next La siguiente función de middleware/controlador.
 */
export const isAuthenticated = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	// 1. Obtener el encabezado de autorización
	const authHeader = req.headers.authorization;

	if (!authHeader) {
		return res.status(401).json({
			message:
				"Acceso denegado. No se proporcionó token de autenticación.",
		});
	}

	// El token suele venir como "Bearer [token]", por eso separamos
	const token = authHeader.split(" ")[1];

	if (!token) {
		return res.status(401).json({
			message: 'Formato de token inválido. Debe ser "Bearer <token>".',
		});
	}

	// 2. Verificar y decodificar el token
	try {
		// Usamos la clave secreta del entorno (ENV.JWT_SECRET)
		const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: string };

		// 3. Adjuntar el payload del usuario a la petición
		// Esto permite a los controladores saber quién hizo la petición
		req.user = { userId: decoded.userId };

		// 4. Continuar al siguiente middleware o controlador
		next();
	} catch (error) {
		// Si la verificación falla (token expirado, incorrecto, etc.)
		console.error("Error al verificar token:", error);
		return res.status(403).json({
			message: "Token inválido o expirado.",
		});
	}
};
