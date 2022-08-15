import express from 'express';
import * as FeedController from '../controllers/feedController';
import { checkAuthentication } from '../middleware/middleware';

/**
 * router refers to http://localhost:8081/feed/...route
 */
const feedRoutes = express.Router();

feedRoutes.get('/', checkAuthentication, FeedController.getFeed);
feedRoutes.post('/bookmark', checkAuthentication, FeedController.addBookmark);
feedRoutes.delete('/bookmark/:uid', checkAuthentication, FeedController.deleteBookmark);
feedRoutes.post('/rating', checkAuthentication, FeedController.addRating);

export default feedRoutes;