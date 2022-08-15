
import { Request, Response } from 'express';
import { badRequestErrorMessage, internalServerErrorMessage } from '../config';
import { findProductByCode } from '../services/openfoodfactsService';

export async function findProduct(req: Request, res: Response) {
    const { code } = req.params;
    try {
        if (!code) { return res.status(400).json(badRequestErrorMessage('Code is missing from request body')); }

        const product = await findProductByCode(code)
        if (product == null) {
            return res.status(404).json({
                error: 'Not Found',
                message: `Product with code = ${code} not found.`
            });
        }
        return res.status(200).send(product)
    } catch (error) {
        return res.status(500).json(internalServerErrorMessage);
    }
}