const BannersAzyk = require('../models/bannersAzyk');

module.exports.reductionBannersAzyk = async () => {
    const banners = await BannersAzyk.findOne().lean()
    if(!banners) await BannersAzyk.create({images: []})
}