import passport from 'passport';
import {
  Profile as GitHubProfile,
  Strategy as GitHubStrategy,
} from 'passport-github2';
import {
  Profile as GoogleProfile,
  Strategy as GoogleStrategy,
  VerifyCallback as GoogleVerifyCallback,
} from 'passport-google-oauth20';

import {
  Profile as FacebookProfile,
  Strategy as FacebookStrategy,
} from 'passport-facebook';

import {
  Profile as TwitterProfile,
  Strategy as TwitterStrategy,
} from 'passport-twitter';

import {
  Profile as DiscordProfile,
  Strategy as DiscordStrategy,
} from 'passport-discord';
import { config } from '../../configs/config';

// import {
//   Profile as LinkedinProfile,
//   Strategy as LinkedinStrategy,
// } from 'passport-linkedin-oauth2';

const strategiesConfig = {
  google: {
    clientID: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    callbackURL: `${config.SERVER_HUB_ORIGIN}/v1/auth/google/callback`,
    scope: ['profile', 'email'],
  },
  github: {
    clientID: config.GITHUB_CLIENT_ID,
    clientSecret: config.GITHUB_CLIENT_SECRET,
    callbackURL: `${config.SERVER_HUB_ORIGIN}/v1/auth/github/callback`,
    scope: ['profile', 'email'],
  },
  facebook: {
    clientID: config.FACEBOOK_CLIENT_ID,
    clientSecret: config.FACEBOOK_CLIENT_SECRET,
    callbackURL: `${config.SERVER_HUB_ORIGIN}/v1/auth/facebook/callback`,
    profileFields: ['id', 'displayName', 'photos', 'email'],
  },
  twitter: {
    consumerKey: config.CONSUMER_KEY,
    consumerSecret: config.CONSUMER_SECRET,
    callbackURL: `${config.SERVER_HUB_ORIGIN}/v1/auth/twitter/callback`,
    profileFields: ['id', 'displayName', 'photos', 'email', 'profile'],
    includeEmail: true,
  },
  discord: {
    clientID: config.DISCORD_CLIENT_ID,
    clientSecret: config.DISCORD_CLIENT_SECRET,
    callbackURL: `${config.SERVER_HUB_ORIGIN}/v1/auth/discord/callback`,
    scope: ['identify', 'email'],
  },
  // linkedin: {
  //   clientID: 'dfdf',
  //   clientSecret: 'dfdf',
  //   callbackURL: `${config.SERVER_HUB_ORIGIN}/v1/auth/linkedin/callback`,
  //   scope: ['r_emailaddress', 'r_liteprofile'],
  //   state: true,
  // },
};

const handleOAuth = async (
  accessToken: string,
  refreshToken: string,
  profile:
    | GoogleProfile
    | GitHubProfile
    | FacebookProfile
    | TwitterProfile
    | DiscordProfile,
  // | LinkedinProfile,
  done: GoogleVerifyCallback
): Promise<void> => {
  return done(null, profile);
};

export const initializePassport = (): void => {
  passport.use(new GoogleStrategy(strategiesConfig.google, handleOAuth));
  passport.use(new GitHubStrategy(strategiesConfig.github, handleOAuth));
  passport.use(new FacebookStrategy(strategiesConfig.facebook, handleOAuth));
  passport.use(new TwitterStrategy(strategiesConfig.twitter, handleOAuth));
  passport.use(new DiscordStrategy(strategiesConfig.discord, handleOAuth));
  // passport.use(new LinkedinStrategy(strategiesConfig.linkedin, handleOAuth));
};
