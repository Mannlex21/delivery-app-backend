// src/models/Store.model.ts

import { Schema, model, Document, Types } from "mongoose";

// --- 1. Definición de Tipos de Datos (Interfaces) ---

// Estructura de la dirección física de la tienda
export interface IStoreAddress {
	street: string;
	city: string;
	zipCode: string;
	// Coordenadas para mostrar en el mapa
	latitude: number;
	longitude: number;
}

// Interfaz principal para el documento de Mongoose
export interface IStore extends Document {
	name: string;
	owner: Types.ObjectId; // Referencia al modelo User (el dueño con rol 'store')
	phone: string;
	email: string;

	address: IStoreAddress; // Dirección anidada

	// Campo GeoJSON para búsquedas por proximidad (¡crucial en delivery!)
	location: {
		type: "Point";
		coordinates: [number, number]; // [longitude, latitude]
	};

	// Horarios, estado y metadatos
	isActive: boolean; // Si la tienda está abierta y visible
	createdAt: Date;
	updatedAt: Date;
}

// --- 2. Definición del Esquema de Mongoose ---

// Esquema para la dirección de la tienda
const StoreAddressSchema = new Schema<IStoreAddress>(
	{
		street: { type: String, required: true },
		city: { type: String, required: true },
		zipCode: { type: String, required: true },
		latitude: { type: Number, required: true },
		longitude: { type: Number, required: true },
	},
	{ _id: false }
);

// Esquema principal de la Tienda
const StoreSchema = new Schema<IStore>({
	name: {
		type: String,
		required: true,
		trim: true,
		unique: true,
	},
	// Referencia al dueño/administrador de la tienda
	owner: {
		type: Schema.Types.ObjectId,
		ref: "User",
		required: true,
	},
	phone: {
		type: String,
		required: true,
	},
	email: {
		type: String,
		required: true,
		unique: true,
	},

	address: {
		type: StoreAddressSchema,
		required: true,
	},

	// Campo GeoJSON para búsquedas por proximidad
	location: {
		type: { type: String, enum: ["Point"], default: "Point" },
		coordinates: { type: [Number], index: "2dsphere" }, // [longitude, latitude]
	},

	isActive: {
		type: Boolean,
		default: true,
	},

	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

// Índice 2dsphere es crucial para buscar tiendas cercanas eficientemente
StoreSchema.index({ location: "2dsphere" });

// Actualiza el campo 'updatedAt' automáticamente antes de guardar
StoreSchema.pre("save", function (next) {
	this.updatedAt = new Date();
	next();
});

// 3. Exportar el Modelo
const Store = model<IStore>("Store", StoreSchema);

export default Store;
