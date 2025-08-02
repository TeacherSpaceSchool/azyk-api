const {getClientRedis} = require('../module/redis');

module.exports.setProfile = async (user, profile)=>{
    let clientRedis = await getClientRedis()
    clientRedis.set(user, profile)
};

module.exports.getProfile = async (client, user)=>{
    let clientRedis = await getClientRedis()
    return await clientRedis.get(user)
};