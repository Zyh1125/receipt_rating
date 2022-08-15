import * as mongoose from 'mongoose';
import { ReceiptProductDBEntry } from './types';

export interface ReceiptInterface extends mongoose.Document {
    date: Date,
    title: string,
    store: string,
    products: ReceiptProductDBEntry[],
    score: string,
    userID: string,
}

export const ReceiptSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    store: {
        type: String,
        required: false,
    },
    products: {
        type: [{
            name: String,
            amount: Number,
            unit: String,
            price: Number,
            product: String,
            ignored: Boolean,
        }],
        required: true,
    },
    score: {
        type: String,
        required: true,
    },
    userID: {
        type: String,
        required: true,
    },
});
/* This maps the internal id of the receipt
 created by mongoose to the field id when accessed via to JSON */
 ReceiptSchema.virtual('id').get(function () {
    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    return this._id.toHexString();
});

ReceiptSchema.set('toJSON', {
    virtuals: true,
});

export default mongoose.model<ReceiptInterface>('Receipt', ReceiptSchema);