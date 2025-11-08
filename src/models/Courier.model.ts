// src/models/Courier.model.ts

import { Schema, model, Document, Types } from "mongoose";

// --- 1. Definición de Tipos de Datos (Interfaces) ---

export type CourierStatus =
	| "OFFLINE"
	| "AVAILABLE" // Listo para aceptar pedidos
	| "BUSY"; // Ocupado con uno o más pedidos

// Interfaz principal para el documento de Mongoose
export interface ICourier extends Document {
	user: Types.ObjectId; // Referencia al modelo User (el repartidor con rol 'courier')
	vehicleType: string; // Ej: 'Motorcycle', 'Bike', 'Car'
	licensePlate: string;

	// Logística y estado
	status: CourierStatus;

	// Campo GeoJSON para el rastreo en tiempo real (crucial)
	currentLocation: {
		type: "Point";
		coordinates: [number, number]; // [longitude, latitude]
	};

	// Metadatos
	createdAt: Date;
	updatedAt: Date;
}

// --- 2. Definición del Esquema de Mongoose ---

const CourierSchema = new Schema<ICourier>({
	// Referencia al usuario principal
	user: {
		type: Schema.Types.ObjectId,
		ref: "User",
		required: true,
		unique: true, // Cada usuario solo debe ser un repartidor
	},

	// Detalles del vehículo
	vehicleType: {
		type: String,
		required: true,
		enum: ["Motorcycle", "Bike", "Car", "Other"],
		default: "Motorcycle",
	},
	licensePlate: {
		type: String,
		required: true,
		unique: true,
	},

	// Estado y ubicación
	status: {
		type: String,
		enum: ["OFFLINE", "AVAILABLE", "BUSY"],
		default: "OFFLINE",
		required: true,
	},

	// Campo GeoJSON para búsquedas por proximidad y rastreo
	currentLocation: {
		type: { type: String, enum: ["Point"], default: "Point" },
		coordinates: { type: [Number], index: "2dsphere", default: [0, 0] }, // [longitude, latitude]
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

// Índice 2dsphere es CRUCIAL para encontrar repartidores cercanos rápidamente
CourierSchema.index({ currentLocation: "2dsphere" });

// Actualiza el campo 'updatedAt' automáticamente antes de guardar
CourierSchema.pre("save", function (next) {
	this.updatedAt = new Date();
	next();
});

// 3. Exportar el Modelo
const Courier = model<ICourier>("Courier", CourierSchema);

export default Courier;
