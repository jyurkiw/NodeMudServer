var chai = require('chai');
var expect = chai.expect;
var assert = require('assert');

var redis = require('redis');
var constants = require('../lib/constants');
var codeutil = require('../lib/util/codeutil');

var client = redis.createClient();

var lib = require('../lib/mud-lib')(client);

var koboldValleyArea = {
    areacode: 'KDV',
    name: "Kobold Valley",
    description: "A valley filled with dangerous Kobolds.",
    size: 0
};

var goblinValleyArea = {
    areacode: 'GCV',
    name: "Goblin Cave",
    description: "A cave filled with goblins.",
    size: 0
};

var westernOverlook = {
    areacode: koboldValleyArea.areacode,
    roomnumber: 1,
    name: 'Western Overlook',
    description: 'A short cliff overlooks a small, fertile valley. You can see scores of Kobolds milling about doing whatever it is Kobolds do.'
};

var goblinCaveEntrance = {
    areacode: goblinValleyArea.areacode,
    roomnumber: 1,
    name: 'Cave Entrance',
    description: 'The opening to this dank cave reeks of Goblin.'
};

var goblinCaveTunnel = {
    areacode: goblinValleyArea.areacode,
    roomnumber: 2,
    name: 'Narrow Corridor',
    description: 'The cave stretches on into the darkness. '
};

var westernOverlookUpdate = {
    name: 'Western Overlook',
    description: 'A short cliff overlooks a small, fertile valley. You can see scores of Kobolds milling about doing whatever it is Kobolds do. A hole in the western rockface opens into a dark cave that reeks of Goblin.'
};

var westernOverlookUpdated = {
    areacode: 'KDV',
    roomnumber: 1,
    name: 'Western Overlook',
    description: 'A short cliff overlooks a small, fertile valley. You can see scores of Kobolds milling about doing whatever it is Kobolds do. A hole in the western rockface opens into a dark cave that reeks of Goblin.'
};

// Tests
describe('The room-lib module', function() {
    // Setup
    beforeEach(function(done) {
        client.flushall();
        lib.setArea(koboldValleyArea.areacode, koboldValleyArea);
        lib.setArea(goblinValleyArea.areacode, goblinValleyArea);

        lib.reserveRoomNumber(koboldValleyArea.areacode, function(roomNumber) {
            westernOverlook.roomnumber = roomNumber;
            lib.setRoom(koboldValleyArea.areacode, roomNumber, westernOverlook);
            done();
        });
    });

    after(function(done) {
        client.flushall();
        done();
    });

    // C
    describe('Create a new room without exits', function() {
        it('Create goblin cave entrance through reserveRoomNumber and setRoom', function(done) {
            lib.reserveRoomNumber(goblinValleyArea.areacode, function(roomNumber) {
                goblinCaveEntrance.roomnumber = roomNumber;
                lib.setRoom(goblinValleyArea.areacode, roomNumber, goblinCaveEntrance, function() {
                    client.hgetall(codeutil.buildRoomCode(goblinCaveEntrance.areacode, roomNumber), function(err, res) {
                        if (typeof(res.roomnumber) === 'string') {
                            res.roomnumber = parseInt(res.roomnumber, 10);
                        }
                        expect(res).to.deep.equal(goblinCaveEntrance);
                        done();
                    });
                });
            });
        });

        it('Create goblin cave entrance through addRoom', function(done) {
            lib.addRoom(goblinValleyArea.areacode, goblinCaveEntrance, function(roomNumber) {
                client.hgetall(codeutil.buildRoomCode(goblinCaveEntrance.areacode, roomNumber), function(err, res) {
                    if (typeof(res.roomnumber) === 'string') {
                        res.roomnumber = parseInt(res.roomnumber, 10);
                    }
                    expect(res).to.deep.equal(goblinCaveEntrance);
                    done();
                });
            });
        })
    });

    // R
    describe('Read rooms', function() {
        it('Read the western overlook.', function(done) {
            lib.getRoom(westernOverlook.areacode, westernOverlook.roomnumber, function(roomData) {
                expect(roomData).to.deep.equal(westernOverlook);
                done();
            });
        });
    });

    // U
    describe('Update room data', function() {
        it('Update the western overlook', function(done) {
            westernOverlookUpdated.roomnumber = westernOverlook.roomnumber;

            lib.setRoom(westernOverlook.areacode, westernOverlook.roomnumber, westernOverlookUpdate, function() {
                lib.getRoom(westernOverlook.areacode, westernOverlook.roomnumber, function(roomData) {
                    expect(roomData).to.deep.equal(westernOverlookUpdated);
                    done();
                });
            });
        });
    });

    // D
    describe('Delete a room', function() {
        it('Delete the western overlook and the kobold valley', function(done) {
            lib.deleteRoom(westernOverlook.areacode, westernOverlook.roomnumber, function(delResponse) {
                expect(delResponse).to.be.a('object');
                expect(delResponse.code).to.equal(constants.AREA_DELETED);

                lib.getRoom(westernOverlook.areacode, westernOverlook.roomnumber, function(roomData) {
                    expect(roomData).to.equal(null);

                    lib.getArea(westernOverlook.areacode, function(area) {
                        expect(area).to.equal(null);
                        done();
                    });
                });
            });
        });

        it('Delete one out of two rooms in the goblin cave', function(done) {
            lib.addRoom(goblinCaveEntrance.areacode, goblinCaveEntrance);
            lib.addRoom(goblinCaveTunnel.areacode, goblinCaveTunnel);

            lib.deleteRoom(goblinCaveEntrance.areacode, goblinCaveEntrance.roomnumber, function(delResponse) {
                expect(delResponse).to.be.a('object');
                expect(delResponse.code).to.equal(constants.OK);
                done();
            });
        });
    });

});