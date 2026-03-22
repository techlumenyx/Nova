import { signup }             from './signup';
import { login }              from './login';
import { verifyOTP }          from './verifyOTP';
import { resendOTP }          from './resendOTP';
import { googleAuth }         from './googleAuth';
import { refreshToken }       from './refreshToken';
import { logout }             from './logout';
import { requestAddContact,
         verifyAddContact }   from './addContact';

export const Mutation = {
  signup,
  login,
  verifyOTP,
  resendOTP,
  googleAuth,
  refreshToken,
  logout,
  requestAddContact,
  verifyAddContact,
};
