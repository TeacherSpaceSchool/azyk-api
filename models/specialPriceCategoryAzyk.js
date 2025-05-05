const mongoose = require('mongoose');

const SpecialPriceCategoryAzykSchema = mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemAzyk'
    },
    price: Number,
    category: String,
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
    },
}, {
    timestamps: true
});

SpecialPriceCategoryAzykSchema.index({category: 1})
SpecialPriceCategoryAzykSchema.index({organization: 1})

const SpecialPriceCategoryAzyk = mongoose.model('SpecialPriceCategoryAzyk', SpecialPriceCategoryAzykSchema);

module.exports = SpecialPriceCategoryAzyk;