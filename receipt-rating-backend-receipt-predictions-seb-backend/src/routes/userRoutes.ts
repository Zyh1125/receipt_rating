import express from 'express';
import * as UserController from '../controllers/userController';
import { checkAuthentication } from '../middleware/middleware';

/**
 * router refers to http://localhost:8081/user/...route
 */
const userRoutes = express.Router();

userRoutes.get('/', checkAuthentication, UserController.getUser);
userRoutes.post('/register', UserController.register);
userRoutes.post('/', UserController.login);
userRoutes.delete('/:id', checkAuthentication, UserController.deleteUser);
userRoutes.post('/logtime/app', checkAuthentication, UserController.logAppTime);
userRoutes.post('/logtime/feed', checkAuthentication, UserController.logScreenTimeFeed);
userRoutes.post('/logtime/overview', checkAuthentication, UserController.logScreenTimeOverviewScreen);

export default userRoutes;