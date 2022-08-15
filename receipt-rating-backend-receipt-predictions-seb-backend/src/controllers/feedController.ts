import { Request, Response } from 'express';
import { badRequestErrorMessage, internalServerErrorMessage } from '../config';
import FeedSchema, { FeedInterface } from '../models/feed';
import { IFeedItem } from '../models/types';
import UserSchema from '../models/user';
import { generateFeed } from '../services/feedService';

/* Trigger feed update and send back the latest generated feed */
export async function getFeed(req: Request, res: Response) {
    try {
        //@ts-ignore
        const userID = req.userId //"61dc3937c8aaadee20b1cbcc"
        let feed = undefined

        // trigger feedService.ts -> generates or updates the feed
        await generateFeed(userID)

        // check if admin then return all receipts - to evaluate the Userstudy
        const user = await UserSchema.findById(userID)
        if (user?.username == 'esteradmin') {
            feed = await FeedSchema.find()
        } else {
            feed = await FeedSchema.find({
                userID: userID
            })
        }

        //console.log(feed[0].ratings.map((rating:any) => {return rating.feedItem.uid}))

        const feedNew = {
            userID: feed[0].userID,
            feed: feed[0].feed,
            bookmarks: feed[0].bookmarks,
            ratings: feed[0].ratings.map((rating:any) => {return rating.feedItem.uid}) // only return list of uid's of rated items
        }

        return res.status(200).send({
            feed: feedNew ?? [],
            message: 'Retrieved Feed'
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json(internalServerErrorMessage);
    }
}

export async function addBookmark(req: Request, res: Response) {
    try {
        //@ts-ignore
        const userID = req.userId //"6230635ad78ad36ff448b971" // 
        const { item } = req.body

        // parse item to IFeedItem
        let feedItem: IFeedItem = {
            uid: item.uid,
            date: new Date(),//item.date,
            itemtype: item.itemtype,
            category: item.category,
            prio: item.prio,
            parameters: item.parameters
        }

        console.log("received add bookmark request")
        const exists = await FeedSchema.findOne({ userID: userID, 'bookmarks.uid': feedItem.uid })
        console.log(exists ? true : false)
        if (exists) {
            return res.status(400).json(badRequestErrorMessage('Item already bookmarked'))
        } else {
            await FeedSchema.updateOne({ userID: userID }, { $push: { bookmarks: feedItem } })
        
            // get and return all bookmarks
            const bookmarks = (await FeedSchema.findOne({ userID: userID }))?.bookmarks
            return res.status(200).send({
                message: 'Bookmarked item ' + feedItem.uid,
                bookmarks: bookmarks
            })
        }
    } catch (error) {
        console.error(error)
        return res.status(500).json(internalServerErrorMessage);
    }
}

export async function deleteBookmark(req: Request, res: Response) {
    const { uid } = req.params;

    try {
        //@ts-ignore
        const userID = req.userId //"6230635ad78ad36ff448b971" // 

        if (!uid) { return res.status(400).json(badRequestErrorMessage('Receipt id missing in request to delete a receipt')) }

        const result = await FeedSchema.updateOne(
            { userID: userID },
            { $pull: { bookmarks: { uid: uid } } }
        )

        // get and return all bookmarks
        const bookmarks = (await FeedSchema.findOne({ userID: userID }))?.bookmarks

        return res.status(200).send({
            message: `Deleted Successfull receipt with id ${uid}`,
            bookmarks: bookmarks
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json(internalServerErrorMessage);
    }
}

export async function addRating(req: Request, res: Response) {
    try {
        //@ts-ignore
        const userID = req.userId //"6230635ad78ad36ff448b971" // 
        const { item, ratingInfo } = req.body

        // parse item to IFeedItem
        let feedItem: IFeedItem = {
            uid: item.uid,
            date: new Date(),//item.date,
            itemtype: item.itemtype,
            category: item.category,
            prio: item.prio,
            parameters: item.parameters
        }

        console.log("received add rating request")
        const exists = await FeedSchema.findOne({ userID: userID, 'ratings.feedItem.uid': feedItem.uid })
        console.log(exists ? true : false)
        if (exists) {
            return res.status(400).json(badRequestErrorMessage('Item already rated'))
        } else {
            await FeedSchema.updateOne({ userID: userID }, { $push: { ratings: {feedItem: feedItem, ratingInfo: ratingInfo} } })
        
            // get and return all ratings
            const ratings = (await FeedSchema.findOne({ userID: userID }))?.ratings.map((rating:any) => {return rating.feedItem.uid})
            console.log(ratings)
            return res.status(200).send({
                message: 'Rated item ' + feedItem.uid,
                ratings: ratings
            })
        }
        //await FeedSchema.updateOne({ userID: userID }, { $push: { ratings: {feedItem: feedItem, ratingInfo: ratingInfo} } })
    } catch (error) {
        console.error(error)
        return res.status(500).json(internalServerErrorMessage);
    }
}