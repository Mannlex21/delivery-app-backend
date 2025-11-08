// src/routes/order.routes.ts

import { Router } from "express";
// Asegúrate de que las rutas relativas sean correctas (.js por ESM)
import { isAuthenticated } from "../middleware/auth.middleware.js";
import * as orderController from "../controllers/order.controller.js";

const router = Router();

// POST /orders: Crear un nuevo pedido (Solo clientes logueados)
router.post("/", isAuthenticated, orderController.createOrder);

// GET /orders/:id: Obtener detalles de un pedido (Requiere autenticación y verificación de propiedad/rol)
router.get("/:id", isAuthenticated, orderController.getOrderDetails);

// PATCH /orders/:id/status: Actualizar el estado del pedido (Requiere autenticación y rol de tienda/repartidor)
router.patch("/:id/status", isAuthenticated, orderController.updateOrderStatus);

// Opcional: GET /orders/my: Obtener todos los pedidos del usuario logueado
router.get("/my", isAuthenticated, orderController.getUserOrders);

export default router;
