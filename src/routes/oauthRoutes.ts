import express from 'express';
import passport from 'passport';
import { config } from '../configs/config';
import { authController } from '../controllers/authController';

const router = express.Router();

router.get('/google', passport.authenticate('google'));

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${config.CLIENT_HUB_ORIGIN}/sign-in`,
  }),
  authController.googleAuth,
  authController.createSession(`${config.CLIENT_HUB_ORIGIN}/sign-in`)
);

router.get('/github', passport.authenticate('github'));

router.get(
  '/github/callback',
  passport.authenticate('github', {
    failureRedirect: `${config.CLIENT_HUB_ORIGIN}/sign-in`,
  }),
  authController.githubAuth,
  authController.createSession(`${config.CLIENT_HUB_ORIGIN}/sign-in`)
);

router.get('/facebook', passport.authenticate('facebook'));
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', {
    failureRedirect: `${config.CLIENT_HUB_ORIGIN}/sign-in`,
  }),
  authController.facebookAuth,
  authController.createSession(`${config.CLIENT_HUB_ORIGIN}/sign-in`)
);

router.get('/twitter', passport.authenticate('twitter'));

router.get(
  '/twitter/callback',
  passport.authenticate('twitter', {
    failureRedirect: `${config.CLIENT_HUB_ORIGIN}/sign-in`,
  }),
  authController.twitterAuth,
  authController.createSession(`${config.CLIENT_HUB_ORIGIN}/sign-in`)
);

router.get('/discord', passport.authenticate('discord'));
router.get(
  '/discord/callback',
  passport.authenticate('discord', {
    failureRedirect: `${config.CLIENT_HUB_ORIGIN}/sign-in`,
  }),
  authController.discordAuth,
  authController.createSession(`${config.CLIENT_HUB_ORIGIN}/sign-in`)
);

export default router;
