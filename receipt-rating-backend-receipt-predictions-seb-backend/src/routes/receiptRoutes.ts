import express from 'express';
import * as ReceiptController from '../controllers/receiptController';
import { checkAuthentication } from '../middleware/middleware';

/**
 * router refers to http://localhost:8081/receipt/...route
 */
const receiptRoutes = express.Router();

receiptRoutes.get('/', checkAuthentication, ReceiptController.getReceipts);
receiptRoutes.post('/', ReceiptController.resolveReceipt);
receiptRoutes.post('/save', checkAuthentication, ReceiptController.saveReceipt);
receiptRoutes.post('/update', checkAuthentication, ReceiptController.updateReceipt);
receiptRoutes.delete('/:id', checkAuthentication, ReceiptController.deleteReceipt);

export default receiptRoutes;