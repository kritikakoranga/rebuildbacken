const express = require('express');
const adminMiddleware = require('../middleware/adminMiddleware');
const videoRouter =  express.Router();
const {generateUploadSignature,saveVideoMetadata,deleteVideo,getVideosByProblem} = require("../controllers/videoSection")

videoRouter.get("/create/:problemId",adminMiddleware,generateUploadSignature);
videoRouter.post("/save",adminMiddleware,saveVideoMetadata);
videoRouter.delete("/delete/:problemId",adminMiddleware,deleteVideo);
videoRouter.get("/problem/:problemId",getVideosByProblem);


module.exports = videoRouter;