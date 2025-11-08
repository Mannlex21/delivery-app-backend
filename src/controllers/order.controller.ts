// src/controllers/order.controller.ts

import { Request, Response } from "express";
import { Types } from "mongoose";

import Order, { IOrder, IOrderItem } from "../models/Order.model.js";
// Asumimos que también tienes los modelos User, Store y Courier
import User from "../models/User.model.js";

// Interfaz para definir el cuerpo de la petición de creación de pedido
// Usamos string para los IDs que vienen del frontend.
interface IItemFromBody {
	productId: string;
	name: string;
	quantity: number;
	price: number;
	notes?: string;
}

interface CreateOrderRequest extends Request {
	body: {
		storeId: string;
		deliveryAddress: any; // Usar una interfaz más estricta en un proyecto real
		items: IItemFromBody[];
	};
	// req.user es añadido por auth.middleware.ts
	user?: { userId: string };
}

/**
 * Obtiene todos los pedidos del usuario logueado.
 * Implementación de la ruta GET /orders/my
 */
export const getUserOrders = async (
	req: Request,
	res: Response
): Promise<void> => {
	const clientId = req.user?.userId;

	if (!clientId) {
		res.status(401).json({ message: "Usuario no autenticado." });
		return;
	}

	try {
		// Buscar todos los pedidos donde el cliente sea el ID del usuario logueado
		const orders = await Order.find({
			client: new Types.ObjectId(clientId),
		})
			.sort({ createdAt: -1 }) // Ordenar por más recientes
			.populate("store", "name address") // Traer información de la tienda
			.select("-courierLocation"); // Ocultar datos sensibles si no son necesarios

		res.status(200).json(orders);
	} catch (error) {
		console.error("Error al obtener pedidos del usuario:", error);
		res.status(500).json({
			message: "Error interno del servidor al consultar pedidos.",
		});
	}
};

/**
 * Función para crear un nuevo pedido.
 */
export const createOrder = async (
	req: CreateOrderRequest,
	res: Response
): Promise<void> => {
	const clientId = req.user?.userId;

	if (!clientId) {
		res.status(401).json({
			message: "Error de autenticación. Usuario no identificado.",
		});
		return;
	}

	const { storeId, deliveryAddress, items } = req.body;

	// 1. Validación básica
	if (!storeId || !deliveryAddress || items.length === 0) {
		res.status(400).json({
			message:
				"Faltan campos obligatorios: tienda, dirección o artículos.",
		});
		return;
	}

	// 2. Calcular el total y mapear items a Types.ObjectId
	const totalAmount = items.reduce(
		(sum, item) => sum + item.quantity * item.price,
		0
	);
	const mappedItems: IOrderItem[] = items.map(
		(item) =>
			({
				productId: new Types.ObjectId(item.productId),
				name: item.name,
				quantity: item.quantity,
				price: item.price,
			} as IOrderItem)
	); // Aserción de tipo para asegurar compatibilidad con la interfaz

	try {
		// 3. Crear el objeto de pedido
		const newOrderData: Partial<IOrder> = {
			client: new Types.ObjectId(clientId),
			store: new Types.ObjectId(storeId),
			deliveryAddress: deliveryAddress,
			items: mappedItems,
			totalAmount: totalAmount,
			status: "PENDING",
		};

		// 4. Guardar el pedido
		const order = new Order(newOrderData);
		await order.save();

		// 5. [Lógica de negocio]: Aquí iría la notificación a la tienda y la búsqueda de repartidores.

		res.status(201).json({
			message: "Pedido creado exitosamente y en espera de confirmación.",
			orderId: order._id,
			total: totalAmount,
		});
	} catch (error) {
		console.error("Error al crear pedido:", error);
		res.status(500).json({
			message: "Error interno del servidor al procesar el pedido.",
		});
	}
};

/**
 * Función para que el cliente o repartidor obtengan los detalles de un pedido específico.
 */
export const getOrderDetails = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const orderId = req.params.id;
		const userId = req.user?.userId;

		// 1. Obtener pedido con referencias populadas
		const order = await Order.findById(orderId)
			.populate("store", "name address")
			.populate("client", "name email")
			.populate("courier", "name phone");

		if (!order) {
			res.status(404).json({ message: "Pedido no encontrado." });
			return;
		}

		// 2. [Lógica de Permisos]: Verificar si el usuario logueado es el cliente, repartidor o administrador.
		// Convertimos el ID de Mongoose a string para comparar con el string del token (userId).
		const isClient = order.client.toString() === userId;
		// const isCourier = order.courier && order.courier.toString() === userId; // Lógica más compleja con el modelo Courier/User

		if (!isClient /* && !isCourier && !isAdmin */) {
			res.status(403).json({
				message:
					"Acceso denegado. No eres el propietario de este pedido.",
			});
			return;
		}

		res.status(200).json(order);
	} catch (error) {
		console.error("Error al obtener detalles del pedido:", error);
		res.status(500).json({ message: "Error interno del servidor." });
	}
};

/**
 * Función para actualizar el estado de un pedido (ej: de PENDING a CONFIRMED).
 */
export const updateOrderStatus = async (
	req: Request,
	res: Response
): Promise<void> => {
	const { status } = req.body;
	const orderId = req.params.id;
	const userId = req.user?.userId; // Usuario que intenta el cambio

	if (!status) {
		res.status(400).json({ message: "El nuevo estado es requerido." });
		return;
	}

	// 1. [Lógica de Permisos]: Verificar rol (Solo tienda o repartidor deberían poder hacer esto).
	// Para simplificar: buscar el rol del usuario logueado.
	const user = await User.findById(userId);
	if (
		user?.role !== "store" &&
		user?.role !== "courier" &&
		user?.role !== "admin"
	) {
		res.status(403).json({
			message:
				"Permiso denegado. Solo tiendas o repartidores pueden actualizar el estado.",
		});
		return;
	}

	try {
		const updatedOrder = await Order.findByIdAndUpdate(
			orderId,
			{ $set: { status: status, updatedAt: new Date() } },
			{ new: true, runValidators: true } // new: devuelve el actualizado, runValidators: verifica el enum del estado
		);

		if (!updatedOrder) {
			res.status(404).json({
				message: "Pedido no encontrado para actualizar.",
			});
			return;
		}

		// 2. [Lógica de Notificación]: Aquí se debe enviar una notificación al cliente.

		res.status(200).json({
			message: `Estado de pedido actualizado a ${status}.`,
			status: updatedOrder.status,
		});
	} catch (error) {
		console.error("Error al actualizar estado del pedido:", error);
		res.status(500).json({ message: "Error interno del servidor." });
	}
};
