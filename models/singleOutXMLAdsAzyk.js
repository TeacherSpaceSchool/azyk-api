const mongoose = require('mongoose');

const singleOutXMLAdsSchema = mongoose.Schema({
    guid: String,
    district: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DistrictAzyk'
   },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },

}, {
    timestamps: true
});


const singleOutXMLAds = mongoose.model('singleOutXMLAds', singleOutXMLAdsSchema);

module.exports = singleOutXMLAds;