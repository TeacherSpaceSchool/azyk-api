const mongoose = require('mongoose');

const BannersAzykSchema = mongoose.Schema({
    images: [String]
}, {
    timestamps: true
});

const BannersAzyk = mongoose.model('BannersAzyk', BannersAzykSchema);

module.exports = BannersAzyk;