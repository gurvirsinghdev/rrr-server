import createUser from "./actions/createUser.js";

export async function seedAdmin() {
  console.log("Creating Admin!");
  await createUser({
    firstName: "Gavin",
    role: "admin",
    email: "admin@redrhinorentals.net",
    password: "12345678",
  });
  console.log("Admin created!");
}

export async function seedDriver() {
  console.log("Creating Driver!");
  await createUser({
    firstName: "Gurvir",
    lastName: "Singh",
    role: "driver",
    email: "hi@gurvirsingh.me",
    password: "12345678",
  });
  console.log("Driver Created!");
}

export async function seedDB() {
  await Promise.all([seedAdmin(), seedDriver()]);
}
