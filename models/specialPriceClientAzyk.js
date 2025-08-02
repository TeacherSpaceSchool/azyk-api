const mongoose = require('mongoose');

const SpecialPriceClientAzykSchema = mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemAzyk'
   },
    price: Number,
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
   },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },
}, {
    timestamps: true
});

SpecialPriceClientAzykSchema.index({client: 1})
SpecialPriceClientAzykSchema.index({organization: 1})

const SpecialPriceClientAzyk = mongoose.model('SpecialPriceClientAzyk', SpecialPriceClientAzykSchema);

module.exports = SpecialPriceClientAzyk;