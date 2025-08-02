//deleteOrganizations
const {deleteOrganizations} = require('./organizations');
//deprecatedOrganizations ids
const deprecatedOrganizations = [
    /*Арпа*/'5ee3b84c43609348d8418b17', /*СВВЗ*/'5f7b58e3110c7139d09de6df', /*Альфа продукт*/'6034cc84691f840f6e287981', /*Масло Сливочное*/'60b210b7c4c75b6368cf81d5',
    /*Armenian Cognac*/'6064afed4d2e20039c8e0348', /*winston*/'5f9c417c5d7963092279e07a', /*ESSE*/'5f1e72c33685a52186f4b6d7', /*АБДЫШ-АТА*/'5ebc30ebccd5b60ed3160994',
    /*Maxi Чай*/'5f6c7b397fc18b68e48a2107', /*FRUIT&BERRY SNACK*/'60193fafd79d1102b0127bcc', /*Народный стандарт*/'5fa690b5f4099c02ab208442',
    /*Мясная лавка*/'5fc0057cf9c57201792e4893', /*КАННАМ*/'5e215f103631d908d1d51038', /*РИХА*/'5ecd4de1c9a5580ef7012e93', /*Куринный двор*/'5ef5ad9f53c0e542cb277bcc',
    /*Шымкентское пиво*/'5f9a6ba1fbe7aa0928c11d37', /*ICE Queen*/'5e1d7e499862344db2df9581', /*БЁМЕР*/'5f741e974df9776b02cf7db6',
    /*bold energy*/'5f743411d54a026b0162ed86', /*MegaOpt*/'5f228227c51cd62187efef62', /*Alokozay*/'5f4f9c8ceacd08648781f895', /*аыва*/'5f2eae5156fce2022db0574c',
    /*testcompany555*/'5e00a4b8f2cd0f4f82eac3d9', /*Сатке*/'5e73494aac40694d3a9a020e', /*Bailuu*/'5e7d82625443997e6deb5efc',
    /*ECO PRODUCT ASIA*/'5e999374672b2a65ad740d5c', /*FRUITLIGHT*/'5ee0ba9f43609348d8414e73', /*Golden Eggs*/'5f62ea597fc18b68e4895234',
    /*LOTOS*/'5f8807c2231cd25eb6e5c4d3', /*СЭМ*/'5f8966b90e93a55eb7204fd0', /*PARLIAMENT*/'5f9c46c8fbe7aa0928c14a02', /*RICHMOND*/'5f9c49285d7963092279e0f6',
    /*Carabao Energy Drink*/'5fb554188ca98d0b0c93d869', /*АВЕДОВЬ*/'5fc882af58b7e43f7e478f5b', /*Desserts Cake*/'5fd344cdaecc12018924492b',
    /*ALLIANCE PRODUCT*/'60784aa949bf2d047a925d4a', /*Oрганизация1*/'608bb56ad356bb739a7d5caf', /*Oрганизация2*/'608bb58ae7881d7393e0a2b8',
    /*Баркад*/'60dd720560ed3704510aa011', /*Бон Аппети*/'60dec69168812904579232aa', /*Био Квас*/'6100e0ef1edca7111325cca1', /*Для хореки*/'614c6490de2c6236689b8c95',
    /*Для маркетов*/'614c64b885ccb1366e3c0c56',
];
//deleteDeprecatedOrganizations
module.exports.deleteDeprecatedOrganizations = async() => {
    await deleteOrganizations(deprecatedOrganizations)
}