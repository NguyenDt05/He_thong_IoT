const express = require("express");
const ctrl = require("../controller/authCtrl");
const { optionalAuth } = require("../service/authSV");

const router = express.Router();

router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
router.get("/me", optionalAuth, ctrl.me);
router.put("/me", optionalAuth, ctrl.updateProfile);
router.post("/logout", optionalAuth, ctrl.logout);
router.put("/avatar", optionalAuth, express.raw({ type: () => true, limit: "2mb" }), ctrl.uploadAvatar);
router.get("/avatar", optionalAuth, ctrl.getAvatar);

router.use((error, _req, res, next) => {
    if (error.type === "entity.too.large") {
        return res.status(413).json({ error: "Ảnh không được vượt quá 2 MB" });
    }
    return next(error);
});

module.exports = router;
