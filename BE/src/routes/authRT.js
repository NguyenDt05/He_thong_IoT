const express = require("express");
const ctrl = require("../controller/authCtrl");
const { requireAuth } = require("../service/authSV");

const router = express.Router();

router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
router.post("/logout", ctrl.logout);

router.use(requireAuth);
router.get("/me", ctrl.me);
router.put("/me", ctrl.updateProfile);
router.put("/avatar", express.raw({ type: () => true, limit: "2mb" }), ctrl.uploadAvatar);
router.get("/avatar", ctrl.getAvatar);

router.use((error, _req, res, next) => {
    if (error.type === "entity.too.large") {
        return res.status(413).json({ error: "Ảnh không được vượt quá 2 MB" });
    }
    return next(error);
});

module.exports = router;
