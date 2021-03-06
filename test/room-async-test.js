var chai = require('chai');
var expect = chai.expect;
var should = chai.should();
var assert = require('assert');

var redis = require('redis');

// Promisify redis
var bluebird = require('bluebird');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

var constants = require('../lib/constants');
var codeutil = require('../lib/util/codeutil');

var client = redis.createClient();

var lib = require('../mud-lib')();

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
describe('The room-lib async module', function() {
    // Setup
    beforeEach(function() {
        return Promise.all([
            client.flushallAsync(),
            lib.area.async.createArea(koboldValleyArea.areacode, koboldValleyArea),
            lib.area.async.createArea(goblinValleyArea.areacode, goblinValleyArea)
        ]);
    });

    after(function() {
        return client.flushallAsync();
    });

    // C
    describe('Create a new room without exits', function() {
        it('Create goblin cave entrance', function() {
            return lib.room.async.addRoom(goblinCaveEntrance.areacode, goblinCaveEntrance)
                .then(function(roomNumber) {
                    return client.hgetallAsync(codeutil.buildRoomCode(goblinCaveEntrance.areacode, roomNumber))
                        .then(function(room) {
                            if (typeof(room.roomnumber) === 'string') {
                                room.roomnumber = parseInt(room.roomnumber, 10);
                            }
                            expect(room).to.deep.equal(goblinCaveEntrance);
                        });
                });
        });

        describe('Check addRoom for roomData argument mangling', function() {
            it('create one room in an area', function() {
                var unmangledCaveEntrance = Object.assign({}, goblinCaveEntrance);
                return lib.room.async.addRoom(unmangledCaveEntrance.areacode, unmangledCaveEntrance)
                    .then(function() {
                        expect(unmangledCaveEntrance).to.deep.equal(goblinCaveEntrance);
                    });
            });

            it('create two rooms in an area', function() {
                var unmangledCaveEntrance = Object.assign({}, goblinCaveEntrance);
                var unmangledCaveTunnel = Object.assign({}, goblinCaveTunnel);

                return Promise.all([
                        lib.room.async.addRoom(unmangledCaveEntrance.areacode, unmangledCaveEntrance),
                        lib.room.async.addRoom(unmangledCaveTunnel.areacode, unmangledCaveTunnel)
                    ])
                    .then(function() {
                        expect(unmangledCaveEntrance).to.deep.equal(goblinCaveEntrance);
                        expect(unmangledCaveTunnel).to.deep.equal(goblinCaveTunnel);
                    });
            });
        });

        describe('Connect the western overlook...', function() {
            beforeEach(function() {
                return lib.room.async.addRoom(goblinCaveEntrance.areacode, goblinCaveEntrance);
            });

            it('...to the goblin cave entrance', function() {
                var wolExit = {
                    source: westernOverlook,
                    command: 'west'
                };

                var gcvExit = {
                    source: goblinCaveEntrance,
                    command: 'east'
                };

                return lib.room.async.connectRooms(wolExit, gcvExit)
                    .then(function() {
                        var wolCode = codeutil.buildRoomCode(westernOverlook.areacode, westernOverlook.roomnumber);
                        var wolECode = codeutil.convertRoomToExitsCode(wolCode);
                        var gcvCode = codeutil.buildRoomCode(goblinCaveEntrance.areacode, goblinCaveEntrance.roomnumber);
                        var gcvECode = codeutil.convertRoomToExitsCode(gcvCode);

                        return client.hgetAsync(wolECode, wolExit.command)
                            .then(function(wres) {
                                expect(wres).to.equal(gcvCode);

                                return client.hgetAsync(gcvECode, gcvExit.command)
                                    .then(function(gres) {
                                        expect(gres).to.equal(wolCode);
                                    });
                            });
                    });
            });
        });
    });

    // R
    describe('Read rooms', function() {
        beforeEach(function() {
            return lib.room.async.addRoom(westernOverlook.areacode, westernOverlook);
        });

        it('Read the western overlook.', function() {
            return lib.room.async.getRoom(westernOverlook.areacode, 1)
                .then(function(room) {
                    expect(room).to.deep.equal(westernOverlook);
                });
        });

        describe('Read the western overlook', function() {
            before(function() {
                return lib.room.async.addRoom(goblinCaveEntrance.areacode, goblinCaveEntrance);
            });

            var exitDir = 'west';

            it('after joining it to the goblin cave entrance.', function() {
                return lib.room.async.setConnection(exitDir, westernOverlook, goblinCaveEntrance)
                    .then(function() {
                        var roomCode = codeutil.buildRoomCode(westernOverlook.areacode, westernOverlook.roomnumber);
                        var roomExitsCode = codeutil.convertRoomToExitsCode(roomCode);
                        var destinationCode = codeutil.buildRoomCode(goblinCaveEntrance.areacode, goblinCaveEntrance.roomnumber);

                        return lib.room.async.getRoom(westernOverlook.areacode, westernOverlook.roomnumber)
                            .then(function(roomData) {
                                should.exist(roomData.exits);
                                expect(roomData.exits).to.be.a('object');
                                expect(roomData.exits[exitDir]).to.equal(destinationCode);
                            });
                    });
            });
        });

        describe('Read room with exits', function() {
            beforeEach(function() {
                return Promise.all([
                        lib.room.async.addRoom(westernOverlook.areacode, westernOverlook),
                        lib.room.async.addRoom(goblinCaveEntrance.areacode, goblinCaveEntrance)
                    ])
                    .then(function() {
                        return lib.room.async.setConnection('west', westernOverlook, goblinCaveEntrance);
                    });
            });

            it('Western overlook after it has been connected to the goblin cave', function() {
                return lib.room.async.getRoom(westernOverlook.areacode, westernOverlook.roomnumber)
                    .then(function(room) {
                        should.exist(room.exits);
                        expect(room.exits).to.be.an('object');
                        expect(room.exits.west).to.equal('RM:' + goblinCaveEntrance.areacode + ':' + goblinCaveEntrance.roomnumber);
                    });
            });
        });

        describe('Read connected rooms', function() {
            beforeEach(function() {
                return Promise.all([
                        lib.room.async.addRoom(westernOverlook.areacode, westernOverlook),
                        lib.room.async.addRoom(goblinCaveEntrance.areacode, goblinCaveEntrance)
                    ])
                    .then(function() {
                        return lib.room.async.connectRooms({ command: 'west', source: westernOverlook }, { command: 'east', source: goblinCaveEntrance });
                    });
            });

            it('Read western overlook and cave entrance after they have been connected to each other', function() {
                return Promise.all([
                        lib.room.async.getRoom(westernOverlook.areacode, westernOverlook.roomnumber),
                        lib.room.async.getRoom(goblinCaveEntrance.areacode, goblinCaveEntrance.roomnumber)
                    ])
                    .then(function(rooms) {
                        expect(rooms).to.be.an('array');
                        expect(rooms.length).to.equal(2);
                        expect(rooms[0].areacode).to.equal(westernOverlook.areacode);

                        var overlook = rooms[0];
                        var entrance = rooms[1];

                        should.exist(overlook.exits);
                        expect(overlook.exits.west).to.be.an('string');
                        expect(overlook.exits.west).to.equal('RM:' + goblinCaveEntrance.areacode + ':' + goblinCaveEntrance.roomnumber);

                        should.exist(entrance.exits);
                        expect(entrance.exits.east).to.be.an('string');
                        expect(entrance.exits.east).to.equal('RM:' + westernOverlook.areacode + ':' + westernOverlook.roomnumber);
                    });
            });
        });
    });

    // U
    describe('Update room data', function() {
        beforeEach(function() {
            return lib.room.async.addRoom(westernOverlook.areacode, westernOverlook);
        });

        it('Update the western overlook', function() {
            return lib.room.async.setRoom(westernOverlook.areacode, westernOverlook.roomnumber, westernOverlookUpdate)
                .then(function() {
                    return lib.room.async.getRoom(westernOverlook.areacode, westernOverlook.roomnumber)
                        .then(function(room) {
                            expect(room).to.deep.equal(westernOverlookUpdated);
                        });
                });
        });

        it('Check for update argument mangling', function() {
            var unmangledWesternOverlookUpdate = Object.assign(westernOverlookUpdate);
            return lib.room.async.setRoom(westernOverlook.areacode, westernOverlook.roomnumber, westernOverlookUpdate)
                .then(function() {
                    expect(westernOverlookUpdate).to.deep.equal(unmangledWesternOverlookUpdate);
                });
        });
    });

    // D
    describe('Delete a room', function() {
        beforeEach(function() {
            return Promise.all([
                lib.room.async.addRoom(goblinCaveEntrance.areacode, goblinCaveEntrance),
                lib.room.async.addRoom(goblinCaveTunnel.areacode, goblinCaveTunnel)
            ]);
        });

        it('Delete one out of two rooms in the goblin cave', function() {
            // Sanity check the goblin cave size
            return lib.area.async.getArea(goblinValleyArea.areacode)
                .then(function(area) {
                    expect(area.size).to.equal(2);

                    // Delete the first room
                    return lib.room.async.deleteRoom(goblinCaveEntrance.areacode, goblinCaveEntrance.roomnumber)
                        .then(function() {
                            return lib.area.async.getArea(goblinValleyArea.areacode)
                                .then(function(area) {
                                    expect(area.size).to.equal(1);

                                    // Delete the second room
                                    return lib.room.async.deleteRoom(goblinCaveTunnel.areacode, goblinCaveTunnel.roomnumber)
                                        .then(function() {
                                            return lib.area.async.getArea(goblinValleyArea.areacode)
                                                .then(function(area) {
                                                    expect(area.size).to.equal(0);
                                                });
                                        });
                                });
                        });
                });
        });
    });

    describe('Delete an exit', function() {
        var gcvWRoom = {
            source: goblinCaveTunnel,
            command: 'east'
        };

        var gcvERoom = {
            source: goblinCaveEntrance,
            command: 'west'
        };

        beforeEach(function() {
            return Promise.all([
                    lib.room.async.addRoom(goblinCaveEntrance.areacode, goblinCaveEntrance),
                    lib.room.async.addRoom(goblinCaveTunnel.areacode, goblinCaveTunnel)
                ])
                .then(function() {
                    return lib.room.async.connectRooms(gcvWRoom, gcvERoom);
                });
        });

        it('Remove an exit from the western overlook to the cave entrance', function() {
            return lib.room.async.getRoom(goblinCaveEntrance.areacode, goblinCaveEntrance.roomnumber)
                .then(function(room) {
                    expect(room.exits).to.be.a('object');
                    expect(room.exits[gcvERoom.command]).to.be.a('string');

                    return lib.room.async.unsetConnection(gcvERoom.command, gcvERoom.source)
                        .then(function() {
                            return lib.room.async.getRoom(goblinCaveEntrance.areacode, goblinCaveEntrance.roomnumber)
                                .then(function(room) {
                                    should.not.exist(room.exits);
                                });
                        });
                });
        });

        describe('...multiple exits', function() {
            it('Remove all connections from the western overlook to the cave entrance', function() {
                return Promise.all([
                        lib.room.async.getRoom(goblinCaveEntrance.areacode, goblinCaveEntrance.roomnumber),
                        lib.room.async.getRoom(goblinCaveTunnel.areacode, goblinCaveTunnel.roomnumber)
                    ])
                    .then(function(rooms) {
                        expect(rooms).to.be.an('Array');
                        expect(rooms.length).to.equal(2);

                        var entrance = rooms[0];
                        var tunnel = rooms[1];

                        return lib.room.async.disconnectRooms(entrance, tunnel)
                            .then(function() {
                                return Promise.all([
                                        lib.room.async.getRoom(goblinCaveEntrance.areacode, goblinCaveEntrance.roomnumber),
                                        lib.room.async.getRoom(goblinCaveTunnel.areacode, goblinCaveTunnel.roomnumber)
                                    ])
                                    .then(function(rooms) {
                                        expect(rooms).to.be.an('Array');
                                        expect(rooms.length).to.equal(2);

                                        entrance = rooms[0];
                                        tunnel = rooms[1];

                                        should.not.exist(entrance.exits);
                                        should.not.exist(tunnel.exits);
                                    });
                            });
                    });
            });
        });

    });
});