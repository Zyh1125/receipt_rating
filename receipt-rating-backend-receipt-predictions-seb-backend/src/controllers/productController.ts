
import { Request, Response } from 'express';
import { badRequestErrorMessage, internalServerErrorMessage } from '../config';
import ProductSchema from '../models/product';
import { findProductByEan, findProductByName } from '../services/productService';

export async function addProduct(req: Request, res: Response) {
    const { product } = req.body;
    try {
        if (!product) { return res.status(400).json(badRequestErrorMessage('No information about the product provided')); }

        const newProduct = new ProductSchema(product);

        if (!newProduct) { return res.status(400).json(badRequestErrorMessage('Invalid Product object')); }

        await newProduct.save();
        return res.status(200).send({
            message: 'Product saved successfully'
        })

    } catch (error) {
        return res.status(500).json(internalServerErrorMessage);
    }
}

export async function findProduct(req: Request, res: Response) {
    const { ean } = req.params;
    const { text } = req.query
    const receiptText = typeof (text) == 'string' ? text : undefined
    try {
        if (!ean) { return res.status(400).json(badRequestErrorMessage('EAN information is missing from request body')); }

        const product = await findProductByEan(ean, receiptText)
        if (product == null) {
            return res.status(404).json({
                error: 'Not Found',
                message: `Product with ean = ${ean} not in Database`
            });
        }
        return res.status(200).send(product)
    } catch (error) {
        return res.status(500).json(internalServerErrorMessage);
    }
}

export async function getProductsByName(req: Request, res: Response) {
    const { name } = req.query
    try {
        if (!name || typeof (name) != 'string') { return res.status(400).json(badRequestErrorMessage('Missing query parameter name')); }

        const products = await findProductByName(name)
        return res.status(200).send(products)
    } catch (error) {
        return res.status(500).json(internalServerErrorMessage);
    }
}

export async function updateProduct(req: Request, res: Response) {
    const { id } = req.params;
    const { product } = req.body;
    try {
        if (!product || id) { return res.status(400).json(badRequestErrorMessage('Missing Context in Body or parameter')); }

        const p = ProductSchema.findById(id)
        if (!p) { return res.status(400).json(badRequestErrorMessage(`Product with id ${id} does not exist in database`)); }

        const productResponse = ProductSchema.findByIdAndUpdate(product)
        return res.status(200).send(productResponse)
    } catch (error) {
        return res.status(500).json(internalServerErrorMessage);
    }
}

export async function deleteProduct(req: Request, res: Response) {
    const { id } = req.params;
    try {
        if (id) { return res.status(400).json(badRequestErrorMessage('Missing parameter id')); }

        ProductSchema.findByIdAndDelete(id)
        return res.status(200).send({
            message: `Deleted product with id ${id} successfully`
        })
    } catch (error) {
        return res.status(500).json(internalServerErrorMessage);
    }
}