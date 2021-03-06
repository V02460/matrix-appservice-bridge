const RoomUpgradeHandler = require("../../lib/components/room-upgrade-handler")

describe("RoomLinkValidator", () => {
    describe("constructor", () => {
        it("should construct", () => {
            const ruh = new RoomUpgradeHandler({isOpts: true}, {isBridge: true});
            expect(ruh._opts).toEqual({isOpts: true, migrateGhosts: true});
            expect(ruh._bridge).toEqual({isBridge: true});
            expect(ruh._waitingForInvite.size).toEqual(0);
        });
    });
    describe("onTombstone", () => {
        it("should join the new room", () => {
            let joined;
            const bridge = {
                getIntent: () => ({
                    join: (room_id) => { joined = room_id; return Promise.resolve(); },
                }),
            };
            const ruh = new RoomUpgradeHandler({}, bridge);
            ruh._onJoinedNewRoom = () => true;
            return ruh.onTombstone({
                room_id: "!abc:def",
                sender: "@foo:bar",
                content: {
                    replacement_room: "!new:def",
                }
            }).then((res) => {
                expect(joined).toEqual("!new:def");
                expect(ruh._waitingForInvite.size).toEqual(0);
                expect(res).toEqual(true);
            });
        });
        it("should wait for an invite on M_FORBIDDEN", () => {
            let joined;
            const bridge = {
                getIntent: () => ({
                    join: (room_id) => { joined = room_id; return Promise.reject({errcode: "M_FORBIDDEN"}); },
                }),
            };
            const ruh = new RoomUpgradeHandler({}, bridge);
            return ruh.onTombstone({
                room_id: "!abc:def",
                sender: "@foo:bar",
                content: {
                    replacement_room: "!new:def",
                }
            }).then((res) => {
                expect(joined).toEqual("!new:def");
                expect(ruh._waitingForInvite.size).toEqual(1);
                expect(res).toEqual(true);
            });
        });
        it("should do nothing on failure", () => {
            let joined;
            const bridge = {
                getIntent: () => ({
                    join: (room_id) => { joined = room_id; return Promise.reject({}); },
                }),
            };
            const ruh = new RoomUpgradeHandler({}, bridge);
            ruh._onJoinedNewRoom = () => true;
            return ruh.onTombstone({
                room_id: "!abc:def",
                sender: "@foo:bar",
                content: {
                    replacement_room: "!new:def",
                }
            }).then((res) => {
                expect(joined).toEqual("!new:def");
                expect(ruh._waitingForInvite.size).toEqual(0);
                expect(res).toEqual(false);
            });
        });
    });
    describe("_joinNewRoom", () => {
        it("should join a room successfully", () => {
            let joined;
            const bridge = {
                getIntent: () => ({
                    join: (room_id) => { joined = room_id; return Promise.resolve({}); },
                }),
            };
            const ruh = new RoomUpgradeHandler({}, bridge);
            return ruh._joinNewRoom("!new:def", "!new:def").then((res) => {
                expect(res).toEqual(true);
                expect(joined).toEqual("!new:def");
            });
        });
        it("should return false on M_FORBIDDEN", () => {
            let joined;
            const bridge = {
                getIntent: () => ({
                    join: (room_id) => { joined = room_id; return Promise.reject({errcode: "M_FORBIDDEN"}); },
                }),
            };
            const ruh = new RoomUpgradeHandler({}, bridge);
            return ruh._joinNewRoom("!new:def").then((res) => {
                expect(joined).toEqual("!new:def");
                expect(res).toEqual(false);
            });
        });
        it("should fail for any other reason", () => {
            const bridge = {
                getIntent: () => ({
                    join: (room_id) => { return Promise.reject({}); },
                }),
            };
            const ruh = new RoomUpgradeHandler({}, bridge);
            return ruh._joinNewRoom("!new:def", "!new:def").catch((err) => {
                expect(err.message).toEqual("Failed to handle upgrade");
            });
        });
    });
    describe("onInvite", () => {
        it("should not handle a unexpected invite", () => {
            const ruh = new RoomUpgradeHandler({}, {});
            expect(ruh.onInvite({
                room_id: "!abc:def",
            })).toEqual(false);
        });
        it("should handle a expected invite", (done) => {
            const ruh = new RoomUpgradeHandler({}, {});
            let newRoomId = false;
            ruh._waitingForInvite.set("!new:def", "!abc:def");
            ruh._joinNewRoom = (_newRoomId) => {
                newRoomId = _newRoomId;
                return Promise.resolve();
            }
            ruh._onJoinedNewRoom = () => {
                expect(newRoomId).toEqual("!new:def");
                done();
            }
            expect(ruh.onInvite({
                room_id: "!new:def",
            })).toEqual(true);
        });
    });
});
