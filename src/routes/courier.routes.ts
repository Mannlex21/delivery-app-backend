// src/routes/courier.routes.ts

import { Router } from "express";
// Asegúrate de que las rutas relativas sean correctas (.js por ESM)
import { isAuthenticated } from "../middleware/auth.middleware.js";
import * as courierController from "../controllers/courier.controller.js";

const router = Router();

// POST /couriers: Crear el perfil de repartidor (Solo usuarios con rol 'courier' o 'admin')
router.post("/", isAuthenticated, courierController.createCourierProfile);

// PATCH /couriers/location: Actualizar la ubicación en tiempo real del repartidor logueado
router.patch(
	"/location",
	isAuthenticated,
	courierController.updateCourierLocation
);

// PATCH /couriers/status: Actualizar el estado (ONLINE/OFFLINE/BUSY) del repartidor logueado
router.patch("/status", isAuthenticated, courierController.updateCourierStatus);

// GET /couriers/available: Ruta de búsqueda para encontrar repartidores disponibles cerca (Para la tienda/admin)
router.get(
	"/available",
	isAuthenticated,
	courierController.getAvailableCouriers
);

export default router;
