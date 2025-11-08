// src/config/env.ts

import * as dotenv from "dotenv";

// Cargar variables de entorno desde el archivo .env
// Busca .env en la raíz del proyecto
dotenv.config();

// Definición de una interfaz (Type) para las variables de entorno
// Esto nos da tipado seguro en todo el proyecto
interface EnvVars {
	NODE_ENV: string;
	PORT: number;
	MONGO_URI: string;
	JWT_SECRET: string; // Clave secreta para la autenticación (JSON Web Tokens)
	// Agrega aquí otras claves como API_KEYs de Google Maps, etc.
}

// Objeto para almacenar las variables validadas
const envVars: Partial<EnvVars> = {};

/**
 * Función para validar y exponer las variables de entorno.
 * Termina el proceso si falta alguna variable crítica.
 */
const validateEnv = (): EnvVars => {
	// 1. Asignar valores (incluyendo defaults)
	envVars.NODE_ENV = process.env.NODE_ENV || "development";
	// Convertimos a número usando parseInt y asignamos un default si falla
	envVars.PORT = parseInt(process.env.PORT || "3000", 10);

	// 2. Asignar valores críticos (SIN defaults)
	envVars.MONGO_URI = process.env.MONGO_URI;
	envVars.JWT_SECRET = process.env.JWT_SECRET;

	// 3. Crear un array de variables faltantes para la validación
	const missingVars: string[] = [];

	// Usamos el objeto envVars, pero TypeScript lo trata como Partial<EnvVars> (parcial),
	// así que verificamos manualmente cuáles son las críticas que faltan.

	if (!envVars.MONGO_URI) {
		missingVars.push("MONGO_URI");
	}
	if (!envVars.JWT_SECRET) {
		missingVars.push("JWT_SECRET");
	}

	// 4. Detener la aplicación si faltan variables críticas
	if (missingVars.length > 0) {
		console.error(
			`❌ Error: Faltan las siguientes variables de entorno críticas: ${missingVars.join(
				", "
			)}`
		);
		// Usamos process.exit(1) para terminar el proceso con un código de error
		process.exit(1);
	}

	// Devolver las variables de entorno tipadas
	return envVars as EnvVars;
};

// Exportamos las variables ya validadas y tipadas
export const ENV = validateEnv();
