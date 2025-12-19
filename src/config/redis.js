


const { createClient }  = require('redis');

const redisClient = createClient({
    username: 'default',
    password: process.env.REDIS_PASS,
    socket: {
        host: 'redis-16726.c305.ap-south-1-1.ec2.redns.redis-cloud.com',
        port: 16726
    }
});

module.exports = redisClient;

 