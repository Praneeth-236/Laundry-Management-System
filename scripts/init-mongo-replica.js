const replicaSetName = "rs0";

try {
  const current = rs.conf();
  if (current._id !== replicaSetName) {
    throw new Error(`MongoDB is already configured as replica set ${current._id}.`);
  }
  print(`Replica set ${replicaSetName} is already initialized.`);
} catch (error) {
  if (error.code !== 94 && error.codeName !== "NotYetInitialized") throw error;
  rs.initiate({
    _id: replicaSetName,
    members: [{ _id: 0, host: "localhost:27017" }],
  });
  print(`Initialized ${replicaSetName}. Wait for localhost:27017 to become primary before starting the API.`);
}
