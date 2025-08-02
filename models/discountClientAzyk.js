const mongoose = require('mongoose');

const DiscountClientAzykSchema = mongoose.Schema({
    discount: Number,
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

DiscountClientAzykSchema.index({client: 1})
DiscountClientAzykSchema.index({organization: 1})

const DiscountClientAzyk = mongoose.model('DiscountClientAzyk', DiscountClientAzykSchema);

module.exports = DiscountClientAzyk;