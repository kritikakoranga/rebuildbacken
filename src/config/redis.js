const { createClient }  = require('redis');

const redisClient = createClient({
    username: 'default',
    password: process.env.REDIS_PASS,
    socket: {
        host: "redis-16139.c301.ap-south-1-1.ec2.cloud.redislabs.com",
        port: 16139
    }
});

redisClient.on('error', (err) => {
    console.log('Redis Client Error', err);
});

redisClient.on('connect', () => {
    console.log('Redis Client Connected');
});

module.exports = redisClient;
