// src/utils/auth.utils.ts (Crea este archivo)

import jwt from "jsonwebtoken";
import { IUser } from "../models/User.model.js";
import crypto from "crypto";
import { ENV } from "../config/env.js";
import { Types } from "mongoose";

/**
 * Genera un token JWT para un ID de usuario dado.
 * Aseguramos que el ID se convierte a string para el payload JWT.
 */
export const createToken = (userId: Types.ObjectId): string => {
	// Usamos .toString() para asegurar que el ID en el payload sea una cadena.
	const idString = userId.toString();

	// El payload contiene el ID del usuario y usa la clave secreta del entorno.
	return jwt.sign({ userId: idString }, ENV.JWT_SECRET, { expiresIn: "7d" });
};

/**
 * Genera el Access Token (JWT) de corta duración.
 */
export const generateAccessToken = (userId: string) => {
	return jwt.sign({ userId }, ENV.JWT_SECRET, { expiresIn: "15m" }); // ¡CORTA DURACIÓN!
};

/**
 * Genera el Refresh Token (String aleatorio) de larga duración y lo guarda en la DB.
 */
export const generateRefreshToken = async (user: IUser) => {
	// 1. Generar un string aleatorio para el Refresh Token
	const tokenValue = crypto.randomBytes(32).toString("hex");

	// 2. Definir la expiración (ej. 7 días)
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días en milisegundos

	// 3. Guardar en el usuario y salvar
	user.refreshTokens.push({
		token: tokenValue,
		expiresAt,
		createdAt: new Date(),
	});

	// Opcional: Limitar el número de tokens (ej. si tiene más de 5 dispositivos, elimina el más antiguo)
	if (user.refreshTokens.length > 5) {
		user.refreshTokens.shift();
	}

	await user.save();
	return tokenValue;
};
