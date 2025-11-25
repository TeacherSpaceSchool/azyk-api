const mongoose = require('mongoose');

const ClientWithoutAdsAzykSchema = mongoose.Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
   }
}, {
    timestamps: true
});

ClientWithoutAdsAzykSchema.index({client: 1})

const ClientWithoutAdsAzyk = mongoose.model('ClientWithoutAdsAzyk', ClientWithoutAdsAzykSchema);

module.exports = ClientWithoutAdsAzyk;