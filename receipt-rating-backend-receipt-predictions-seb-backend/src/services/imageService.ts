import FormData from 'form-data'
import axios, { AxiosResponse } from 'axios'
import * as fs from 'fs';
import { formRecognizerClient, imageServiceURI } from '../config'
import { FormField, RecognizedForm } from '@azure/ai-form-recognizer';
import { IReceiptInformation, ReceiptImageServiceResponse } from '../models/types';

/**
 * sends image of a receipt to the imageService server and gets as a response a list with the detected product receipt names
 * 
 * @param file ReadableStream of an image
 * @returns list of products as type 'ReceiptImageServiceResponse'
 */
export const sendReceiptImage = async (file: ReadableStream): Promise<ReceiptImageServiceResponse> => {
    //init form data
    const form: FormData = new FormData();
    form.append('image', file);

    //get http header from form
    const formHeaders: FormData.Headers = form.getHeaders()

    //request receipt service
    const result: AxiosResponse = await axios.post(
        imageServiceURI,
        form, {
        headers: {
            ...formHeaders,
        },
    })

    return result.data
}

export const recognizeReceipt = async (fileUrl: string): Promise<IReceiptInformation> => {
    const file = fs.createReadStream(fileUrl)
    const poller = await formRecognizerClient.beginRecognizeReceipts(file,
        {
            contentType: "image/png",
            onProgress: (state) => { console.log(`status: ${state.status}`); }
        }
    );

    const receipts = await poller.pollUntilDone();

    if (!receipts || receipts.length <= 0) {
        throw new Error("Expecting at lease one receipt in analysis result");
    }

    const receiptInformation: IReceiptInformation = {
        items: [],
        unknownItems: [],
    }

    // format receipt data
    const receipt: RecognizedForm = receipts[0];

    const merchantNameField = receipt.fields["MerchantName"];
    if (merchantNameField?.valueType === "string") {
        receiptInformation.store = merchantNameField.value ?? '';
    }
    /* leads to errors
    const transactionDate = receipt.fields["TransactionDate"];
    if (transactionDate?.valueType === "date") {
        receiptInformation.date = transactionDate.value ?? new Date();
    } */
    const itemsField = receipt.fields["Items"];
    if (itemsField?.valueType === "array") {
        for (const itemField of itemsField.value || []) {
            if (itemField.value && itemField?.valueType === "object") {
                const itemNameField: FormField | undefined = itemField.value["Name"];
                const itemQuantityField: FormField | undefined = itemField.value["Quantity"];
                const itemPriceField: FormField | undefined = itemField.value["TotalPrice"];

                if (itemNameField?.valueType === "string") {
                    if (itemNameField?.confidence && itemNameField?.confidence >= 0.5) {
                        receiptInformation.items.push({
                            name: itemNameField?.value ?? '',
                            amount: (itemQuantityField?.valueType == 'number' && itemQuantityField?.value) ? itemQuantityField?.value : 1,
                            unit: (itemQuantityField?.valueType == 'number') ? (itemQuantityField?.value && itemQuantityField?.value < 30) ? 'piece' : 'g' : 'piece',
                            price: (itemPriceField?.valueType == 'number' && itemPriceField?.value) ? itemPriceField?.value : 0
                        })
                    } else {
                        receiptInformation.unknownItems.push({
                            name: itemNameField?.value ?? '',
                            amount: (itemQuantityField?.valueType == 'number' && itemQuantityField?.value) ? itemQuantityField?.value : 1,
                            unit: (itemQuantityField?.valueType == 'number') ? (itemQuantityField?.value && itemQuantityField?.value < 30) ? 'piece' : 'g' : 'piece',
                            price: (itemPriceField?.valueType == 'number' && itemPriceField?.value) ? itemPriceField?.value : 0
                        })
                    }
                }
            }
        }
    }
    const totalField = receipt.fields["Total"];
    if (totalField?.valueType === "number") {
        receiptInformation.totalPrice = totalField.value ?? 0;
    }
    return receiptInformation
}