// src/models/Order.model.ts

import { Schema, model, Document, Types } from "mongoose";

// --- 1. Definición de Tipos de Datos (Interfaces) ---

// Estados posibles del pedido
export type OrderStatus =
	| "PENDING" // Pendiente de confirmación de la tienda
	| "CONFIRMED" // Tienda aceptó el pedido
	| "SEARCHING_COURIER" // Buscando repartidor disponible
	| "ON_DELIVERY" // Repartidor recogió y va en camino
	| "DELIVERED" // Entregado exitosamente
	| "CANCELLED"; // Cancelado (por cliente o tienda)

// Estructura de un artículo dentro del pedido
export interface IOrderItem {
	productId: Types.ObjectId; // Referencia al producto (si tuvieras un modelo Product)
	name: string;
	quantity: number;
	price: number;
	notes?: string;
}

// Estructura de la dirección de entrega
export interface IDeliveryAddress {
	street: string;
	city: string;
	zipCode: string;
	notes?: string;
	// Coordenadas cruciales para el mapa
	latitude: number;
	longitude: number;
}

// Interfaz principal para el documento de Mongoose
export interface IOrder extends Document {
	client: Types.ObjectId; // Referencia al modelo User (el cliente)
	store: Types.ObjectId; // Referencia al modelo Store
	courier?: Types.ObjectId; // Referencia al modelo Courier (opcional al inicio)

	status: OrderStatus;

	items: IOrderItem[];
	totalAmount: number;

	deliveryAddress: IDeliveryAddress;

	// Rastreo de tiempo y estado
	createdAt: Date;
	updatedAt: Date;
	deliveryEstimate?: Date; // Estimación de entrega

	// Geolocalización del repartidor para seguimiento en tiempo real
	courierLocation?: {
		type: "Point"; // Tipo GeoJSON para consultas de localización
		coordinates: [number, number]; // [longitude, latitude]
	};
}

// --- 2. Definición del Esquema de Mongoose ---

// Esquema para la dirección de entrega
const DeliveryAddressSchema = new Schema<IDeliveryAddress>(
	{
		street: { type: String, required: true },
		city: { type: String, required: true },
		zipCode: { type: String, required: true },
		notes: { type: String },
		latitude: { type: Number, required: true },
		longitude: { type: Number, required: true },
	},
	{ _id: false }
); // No queremos un ID propio para este subdocumento

// Esquema para los artículos del pedido
const OrderItemSchema = new Schema<IOrderItem>(
	{
		productId: { type: Schema.Types.ObjectId, required: true },
		name: { type: String, required: true },
		quantity: { type: Number, required: true, min: 1 },
		price: { type: Number, required: true, min: 0 },
		notes: { type: String },
	},
	{ _id: false }
);

// Esquema principal del Pedido
const OrderSchema = new Schema<IOrder>({
	// Referencias
	client: { type: Schema.Types.ObjectId, ref: "User", required: true },
	store: { type: Schema.Types.ObjectId, ref: "Store", required: true },
	courier: { type: Schema.Types.ObjectId, ref: "Courier", default: null },

	// Información del pedido
	status: {
		type: String,
		enum: [
			"PENDING",
			"CONFIRMED",
			"SEARCHING_COURIER",
			"ON_DELIVERY",
			"DELIVERED",
			"CANCELLED",
		],
		default: "PENDING",
		required: true,
	},
	items: { type: [OrderItemSchema], required: true },
	totalAmount: { type: Number, required: true, min: 0 },

	deliveryAddress: { type: DeliveryAddressSchema, required: true },

	// Rastreo
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
	deliveryEstimate: { type: Date },

	// Campo GeoJSON para indexación de mapas y consultas de ubicación
	courierLocation: {
		type: { type: String, enum: ["Point"], default: "Point" },
		coordinates: { type: [Number], index: "2dsphere" }, // [longitude, latitude]
	},
});

// Actualiza el campo 'updatedAt' automáticamente antes de guardar
OrderSchema.pre("save", function (next) {
	this.updatedAt = new Date();
	next();
});

// 3. Exportar el Modelo
const Order = model<IOrder>("Order", OrderSchema);

export default Order;
