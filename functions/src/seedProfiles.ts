export const profiles = [
  { uid: "u1", isTest: true, displayName: "Marta Schmidt", bio: "Urban gardener and sourdough devotee. 3rd floor, Boxhagener Str.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marta" },
  { uid: "u2", isTest: true, displayName: "Lukas Weber", bio: "Carpenter by trade. If it's broken, I'll fix it.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lukas" },
  { uid: "u3", isTest: true, displayName: "Aya Tanaka", bio: "Yoga teacher and watercolor painter. Quiet mornings, loud art.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aya" },
  { uid: "u4", isTest: true, displayName: "Sven Müller", bio: "Retired electrician. Chess and radio repair keep me busy.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sven" },
  { uid: "u5", isTest: true, displayName: "Elena Petrova", bio: "Baker, block-party organizer, and community garden regular.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Elena" },
  { uid: "u6", isTest: true, displayName: "Faisal Khan", bio: "Software dev by day, bike mechanic by weekend.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Faisal" },
  { uid: "u7", isTest: true, displayName: "Greta Braun", bio: "Piano and guitar teacher. Music is the neighborhood glue.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Greta" },
  { uid: "u8", isTest: true, displayName: "Henry Davis", bio: "British expat, freelance writer, amateur photographer.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Henry" },
  { uid: "u9", isTest: true, displayName: "Sophie Laurent", bio: "French chef and language tutor. Will cook for conversation.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie" },
  { uid: "u10", isTest: true, displayName: "Jakob Fischer", bio: "Mechanic. Bikes, cars, anything with wheels.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jakob" },
  { uid: "u11", isTest: true, displayName: "Lena Hoffmann", bio: "Midwife and herbalist. Herbal tea solves most things.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lena" },
  { uid: "u12", isTest: true, displayName: "Omar Hassan", bio: "Barber and youth football coach. Sundays are for the kids.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Omar" },
  { uid: "u13", isTest: true, displayName: "Petra Nowak", bio: "Librarian. Running the street library and a book club.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Petra" },
  { uid: "u14", isTest: true, displayName: "Kenji Sato", bio: "Sushi chef and Aikido practitioner. Precision in all things.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kenji" },
  { uid: "u15", isTest: true, displayName: "Maria Gonzalez", bio: "Salsa dancer and Spanish tutor. Bringing warmth to Berlin winters.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria" },
  { uid: "u16", isTest: true, displayName: "Thomas Richter", bio: "Architect by day, woodworker by night. Building for the Kiez.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Thomas" },
  { uid: "u17", isTest: true, displayName: "Yuki Yamamoto", bio: "Illustrator and manga artist. Drawing the neighborhood one face at a time.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuki" },
  { uid: "u18", isTest: true, displayName: "Bruno Costa", bio: "Coffee roaster and barista. Your morning ritual, perfected.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bruno" },
  { uid: "u19", isTest: true, displayName: "Freya Lindström", bio: "Sustainable fashion. Mending is the new buying.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Freya" },
  { uid: "u20", isTest: true, displayName: "Dario Bianchi", bio: "Vinyl collector and Italian home cook. Good music, good pasta.", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dario" },
];

export const circles = [
  { id: "c_garden", isTest: true, name: "Boxi Urban Gardeners", description: "Sharing seeds, tools, harvest, and growing tips from our community plots.", privacy: "PUBLIC", creator: "u1" },
  { id: "c_fixit", isTest: true, name: "Altbau Fixers", description: "Helping each other maintain and renovate our beautiful old apartments.", privacy: "PUBLIC", creator: "u2" },
  { id: "c_parents", isTest: true, name: "Kiez Parents", description: "Connecting families for childcare swaps, playdates, and gear exchange.", privacy: "PUBLIC", creator: "u11" },
  { id: "c_tech", isTest: true, name: "Tech for Good Berlin", description: "Volunteering tech skills for local social projects and digital literacy.", privacy: "PUBLIC", creator: "u6" },
  { id: "c_music", isTest: true, name: "Neukölln Musicians", description: "Jam sessions, gear sharing, rehearsal space, and open mic nights.", privacy: "PUBLIC", creator: "u7" },
  { id: "c_cooking", isTest: true, name: "Kiez Kitchen Collective", description: "Recipe swaps, communal cooking nights, and food preservation workshops.", privacy: "PUBLIC", creator: "u9" },
  { id: "c_bikes", isTest: true, name: "Berlin Bike Kitchen", description: "DIY bike repair, parts sharing, and group rides through the city.", privacy: "PUBLIC", creator: "u10" },
  { id: "c_books", isTest: true, name: "Straßenbibliothek Book Club", description: "Monthly reads, street library maintenance, and literary discussions.", privacy: "PUBLIC", creator: "u13" },
  { id: "c_art", isTest: true, name: "Street Art Collective", description: "Murals, zines, gallery walks, and creative community projects.", privacy: "PUBLIC", creator: "u3" },
  { id: "c_zero", isTest: true, name: "Zero Waste Neukölln", description: "Tips, swaps, and projects for reducing waste in our neighborhood.", privacy: "PUBLIC", creator: "u19" },
];


export const circleMemberships: Record<string, string[]> = {
  u1: ["c_garden","c_cooking","c_zero"], u2: ["c_fixit","c_bikes"],
  u3: ["c_art","c_books","c_tech"], u4: ["c_fixit","c_garden"],
  u5: ["c_garden","c_cooking","c_parents","c_zero"], u6: ["c_tech","c_fixit","c_bikes"],
  u7: ["c_music","c_books"], u8: ["c_parents","c_books","c_art"],
  u9: ["c_music","c_cooking"], u10: ["c_fixit","c_bikes"],
  u11: ["c_parents","c_zero","c_garden"], u12: ["c_parents","c_music","c_bikes"],
  u13: ["c_books","c_garden"], u14: ["c_tech","c_cooking"],
  u15: ["c_parents","c_music","c_art"], u16: ["c_fixit","c_bikes","c_zero","c_garden"],
  u17: ["c_tech","c_books","c_art"], u18: ["c_tech","c_cooking"],
  u19: ["c_zero","c_art"], u20: ["c_music","c_cooking"],
};

export const inviteChain: Record<string, string> = {
  u1: "CALLER", u2: "u1", u3: "u1", u4: "u2", u5: "u1",
  u6: "u5", u7: "CALLER", u8: "u7", u9: "u8", u10: "u7",
  u11: "CALLER", u12: "u11", u13: "u11", u14: "u13",
  u15: "CALLER", u16: "u15", u17: "u16", u18: "u6",
  u19: "u11", u20: "u9",
};

export const mosaicData: Record<string, { completedExchanges: number; imeceParticipations: number; circleCount: number; vouchCount: number }> = {
  u1:  { completedExchanges: 18, imeceParticipations: 4, circleCount: 3, vouchCount: 5 },
  u2:  { completedExchanges: 14, imeceParticipations: 3, circleCount: 2, vouchCount: 4 },
  u3:  { completedExchanges: 9, imeceParticipations: 2, circleCount: 3, vouchCount: 3 },
  u4:  { completedExchanges: 22, imeceParticipations: 5, circleCount: 2, vouchCount: 6 },
  u5:  { completedExchanges: 20, imeceParticipations: 8, circleCount: 4, vouchCount: 7 },
  u6:  { completedExchanges: 11, imeceParticipations: 3, circleCount: 3, vouchCount: 3 },
  u7:  { completedExchanges: 25, imeceParticipations: 6, circleCount: 2, vouchCount: 8 },
  u8:  { completedExchanges: 8, imeceParticipations: 2, circleCount: 3, vouchCount: 2 },
  u9:  { completedExchanges: 15, imeceParticipations: 4, circleCount: 2, vouchCount: 5 },
  u10: { completedExchanges: 19, imeceParticipations: 5, circleCount: 2, vouchCount: 6 },
  u11: { completedExchanges: 12, imeceParticipations: 3, circleCount: 3, vouchCount: 4 },
  u12: { completedExchanges: 10, imeceParticipations: 4, circleCount: 3, vouchCount: 3 },
  u13: { completedExchanges: 16, imeceParticipations: 2, circleCount: 2, vouchCount: 5 },
  u14: { completedExchanges: 7, imeceParticipations: 2, circleCount: 2, vouchCount: 2 },
  u15: { completedExchanges: 13, imeceParticipations: 3, circleCount: 3, vouchCount: 4 },
  u16: { completedExchanges: 21, imeceParticipations: 6, circleCount: 4, vouchCount: 7 },
  u17: { completedExchanges: 6, imeceParticipations: 2, circleCount: 3, vouchCount: 2 },
  u18: { completedExchanges: 9, imeceParticipations: 3, circleCount: 2, vouchCount: 3 },
  u19: { completedExchanges: 11, imeceParticipations: 4, circleCount: 2, vouchCount: 4 },
  u20: { completedExchanges: 8, imeceParticipations: 2, circleCount: 2, vouchCount: 2 },
};

export const gratitudeNotes = [
  { from: "u5", to: "u1", itemTitle: "Sourdough Starter", text: "Marta's starter changed my mornings. Real Kiez magic." },
  { from: "u2", to: "u10", itemTitle: "Bosch Hammer Drill", text: "Jakob saved my weekend with that drill. Absolute legend." },
  { from: "u3", to: "u7", itemTitle: "Spare Acoustic Guitar", text: "Greta's guitar got me through a rough month. Thank you." },
  { from: "u8", to: "u4", itemTitle: "German Document Translation", text: "Sven helped me understand my rental contract. Lifesaver." },
  { from: "u1", to: "u16", itemTitle: "Raised Garden Beds", text: "Thomas built the most beautiful beds. The whole Hof is grateful." },
  { from: "u12", to: "u6", itemTitle: "Free Coding Workshop", text: "Faisal's workshop changed my son's life. He codes every day now." },
  { from: "u9", to: "u14", itemTitle: "Sushi Masterclass", text: "Kenji's sushi class was the best evening I've had in Berlin." },
  { from: "u19", to: "u5", itemTitle: "Community Brunch", text: "Elena's brunch brought the whole building together. We needed that." },
  { from: "u15", to: "u20", itemTitle: "Vinyl Listening Session", text: "Dario's vinyl night was pure soul. More of this please." },
  { from: "u17", to: "u13", itemTitle: "Street Library Book Exchange", text: "Petra's library is a treasure. Found a book that changed my perspective." },
  { from: "u11", to: "u9", itemTitle: "French Cooking Lesson", text: "Sophie's ratatouille recipe is now a family staple. Merci!" },
  { from: "u6", to: "u2", itemTitle: "Cordless Drill Set", text: "Lukas's drill got my shelves up in 20 minutes. Nachbarschaftshilfe!" },
  { from: "u20", to: "u18", itemTitle: "Fresh Roasted Coffee Beans", text: "Bruno's beans are better than any café in Neukölln." },
  { from: "u4", to: "u11", itemTitle: "Herbal Tea Collection", text: "Lena's chamomile blend fixed my insomnia. Truly grateful." },
  { from: "u16", to: "u19", itemTitle: "Clothing Swap and Repair Café", text: "Freya's swap event saved me from buying new winter clothes." },
];

export const seedVouches = [
  // Horizontal vouches to create a more connected web rather than just a tree
  { from: "u2", to: "u5" },
  { from: "u1", to: "u10" },
  { from: "u3", to: "u11" },
  { from: "u6", to: "u7" },
  { from: "u4", to: "u15" },
  { from: "u8", to: "u13" },
  { from: "u9", to: "u20" },
  { from: "u12", to: "u16" },
  { from: "u18", to: "u19" },
  { from: "u14", to: "u2" }
];
