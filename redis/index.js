let redis = require('redis')

module.exports.startRedis = ()=>{
    let client = redis.createClient()
    client.on('error', (err) => {
        console.error(err);
   });
    return client
};