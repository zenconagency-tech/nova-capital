/**
 * User controller — profile, password change.
 */
const { Users } = require('../models');
const { hashPassword, comparePassword, passwordPolicy } = require('../utils/password');
const { sendOk, HttpError } = require('../utils/http');

module.exports = {
  /* ------------------------------------------------------------ */
  /*  GET /api/users/me                                           */
  /* ------------------------------------------------------------ */
  async me(req, res) {
    const { password_hash, ...safe } = req.user;
    return sendOk(res, { user: safe });
  },

  /* ------------------------------------------------------------ */
  /*  PATCH /api/users/me  (name, avatar)                         */
  /* ------------------------------------------------------------ */
  async updateMe(req, res) {
    const { fullName, avatarUrl } = req.body;
    await Users.updateProfile(req.user.id, { fullName, avatarUrl });
    const fresh = await Users.findByIdWithSecrets(req.user.id);
    const { password_hash, ...safe } = fresh;
    return sendOk(res, { user: safe }, 'Profile updated.');
  },

  /* ------------------------------------------------------------ */
  /*  POST /api/users/me/change-password                          */
  /* ------------------------------------------------------------ */
  async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;
    const ok = await comparePassword(currentPassword, req.user.password_hash);
    if (!ok) throw new HttpError(400, 'Current password is incorrect');
    const policyErrors = passwordPolicy(newPassword);
    if (policyErrors.length) throw new HttpError(400, policyErrors.join('. '));
    const passwordHash = await hashPassword(newPassword);
    await Users.updatePassword(req.user.id, passwordHash);
    return sendOk(res, null, 'Password updated successfully.');
  },
};
