import * as mongoose from 'mongoose';
import { IFeed } from './types';

export interface FeedInterface extends mongoose.Document {
    feed: IFeed[],
    bookmarks: IFeed[],
    ratings: any,
    userID: string,
}

export const FeedSchema = new mongoose.Schema({
    feed: {
        type: [{
            uid: String,
            date: Date,
            itemtype: String,
            prio: Number,
            category: String,
            parameters: Object,
        }],
        required: true,
    },
    bookmarks: {
        type: [{
            uid: String,
            date: Date,
            itemtype: String,
            prio: Number,
            category: String,
            parameters: Object,
        }],
        required: true,
    },
    userID: {
        type: String,
        required: true,
    },
    ratings: {
        type: [Object],
        required: true
    }
});

/* This maps the internal id of the profile
 created by mongoose to the field id when accessed via to JSON */
/*  FeedSchema.virtual('id').get(function () {
    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    return this._id.toHexString();
});

FeedSchema.set('toJSON', {
    virtuals: true,
}); */

export default mongoose.model<FeedInterface>('Feed', FeedSchema);