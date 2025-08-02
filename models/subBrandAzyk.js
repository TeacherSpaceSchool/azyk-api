const mongoose = require('mongoose');
const SubBrandAzykSchema = mongoose.Schema({
    image: String,
    miniInfo: String,
    status: String,
    guid: String,
    name: String,
    minimumOrder: Number,
    priotiry: {
        type: Number,
        default: 0
   },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },
    del: String,
    cities: [String],
}, {
    timestamps: true
});

const SubBrandAzyk = mongoose.model('SubBrandAzyk', SubBrandAzykSchema);


module.exports = SubBrandAzyk;