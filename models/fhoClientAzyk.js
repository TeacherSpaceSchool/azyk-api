const mongoose = require('mongoose');

const FhoClientAzykSchema = mongoose.Schema({
    history: mongoose.Schema.Types.Mixed,
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
   },
    images: [String],
}, {
    timestamps: true
});

FhoClientAzykSchema.index({images: 1})
FhoClientAzykSchema.index({organization: 1});
FhoClientAzykSchema.index({client: 1});
FhoClientAzykSchema.index({employment: 1});

const FhoClientAzyk = mongoose.model('FhoClientAzyk', FhoClientAzykSchema);

module.exports = FhoClientAzyk;