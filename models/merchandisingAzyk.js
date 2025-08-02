const mongoose = require('mongoose');

const MerchandisingAzykSchema = mongoose.Schema({
    employment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
   },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
   },
    date: Date,
    productAvailability: [String],
    productInventory: Boolean,
    productConditions: Number,
    productLocation: Number,
    images: [String],
    fhos: mongoose.Schema.Types.Mixed,
    needFho: Boolean,
    check: Boolean,
    stateProduct: Number,
    type: String,
    comment: String,
    geo: String,
    reviewerScore: {
        type: Number,
        default: 0
   },
    reviewerComment: {
        type: String,
        default: ''
   },
}, {
    timestamps: true
});

MerchandisingAzykSchema.index({date: 1})
MerchandisingAzykSchema.index({stateProduct: 1})
MerchandisingAzykSchema.index({check: 1})
MerchandisingAzykSchema.index({organization: 1});
MerchandisingAzykSchema.index({client: 1});
MerchandisingAzykSchema.index({employment: 1});

const MerchandisingAzyk = mongoose.model('MerchandisingAzyk', MerchandisingAzykSchema);

module.exports = MerchandisingAzyk;