// src/models/User.model.ts

import { Schema, model, Document, Types } from "mongoose";
import * as bcrypt from "bcryptjs"; // Asegúrate de instalar bcryptjs

// --- 1. Definición de Tipos de Datos (Interfaces) ---

export type UserRole = "client" | "store" | "courier" | "admin";

interface IRefreshToken {
	token: string;
	expiresAt: Date;
	createdAt: Date;
}

// Interfaz principal para el documento de Mongoose
export interface IUser extends Document {
	email: string;
	password: string; // La contraseña hasheada
	name: string;
	phone: string;
	role: UserRole;
	createdAt: Date; // <--- AÑADIDO
	updatedAt: Date; // <--- Puedes añadirla por si la usas más tarde
	// Método para comparar contraseñas
	comparePassword: (password: string) => Promise<boolean>;
	refreshTokens: IRefreshToken[];
}

// --- 2. Definición del Esquema de Mongoose ---

const UserSchema = new Schema<IUser>(
	{
		email: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			lowercase: true,
		},
		password: {
			type: String,
			required: true,
			// Importante: No enviar la contraseña por defecto en las consultas GET
			select: false,
		},
		name: {
			type: String,
			required: true,
		},
		phone: {
			type: String,
			required: true,
		},
		role: {
			type: String,
			enum: ["client", "store", "courier", "admin"],
			default: "client",
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
		refreshTokens: [
			{
				token: { type: String, required: true },
				expiresAt: { type: Date, required: true },
				createdAt: { type: Date, default: Date.now },
			},
		],
	},
	{ timestamps: true }
);

// --- 3. Middleware y Métodos (Hashing) ---

/**
 * Middleware PRE-SAVE: Hashear la contraseña antes de guardar el usuario
 * Se ejecuta solo si la contraseña ha sido modificada (al registrar o cambiarla).
 */
UserSchema.pre("save", async function (next) {
	const user = this; // Referencia al documento actual

	// Solo hasheamos si el campo 'password' ha sido modificado
	if (!user.isModified("password")) {
		return next();
	}

	try {
		// Generar el hash de la contraseña (usamos un factor de 10)
		user.password = await bcrypt.hash(user.password, 10);
		next();
	} catch (error) {
		// Pasa el error para detener el guardado
		return next(error as Error);
	}
});

/**
 * Método de instancia para comparar una contraseña proporcionada
 * con la contraseña hasheada almacenada en la base de datos.
 */
UserSchema.methods.comparePassword = function (
	candidatePassword: string
): Promise<boolean> {
	// Retorna la promesa de bcrypt.compare
	// 'this.password' es la contraseña hasheada de la DB
	return bcrypt.compare(candidatePassword, this.password);
};

// 4. Exportar el Modelo
const User = model<IUser>("User", UserSchema);

export default User;
