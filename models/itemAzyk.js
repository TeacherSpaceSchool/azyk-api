const mongoose = require('mongoose');

const ItemAzykSchema = mongoose.Schema({
    unit: {
        type: String,
        default: ''
    },
    name: String,
    image: String,
    price: Number,
    costPrice: {
        type: Number,
        default: 0
    },
    packaging:  {
        type: Number,
        default: 1
    },
    reiting: Number,
    apiece: {
        type: Boolean,
        default: false
    },
    subCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubCategoryAzyk'
    },
    subBrand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubBrandAzyk'
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
    },
    hit: Boolean,
    latest: Boolean,
    del: String,
    status: String,
    info: String,
    categorys: [String],
    city: String,
    weight: {
        type: Number,
        default: 0
    },
    priotiry: {
        type: Number,
        default: 0
    },
    size: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});


const ItemAzyk = mongoose.model('ItemAzyk', ItemAzykSchema);

module.exports = ItemAzyk;