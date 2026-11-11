export {
  addClientNote,
  archiveClient,
  createClient,
  getClient,
  listClientNotes,
  listClients,
  loadClient,
  unarchiveClient,
  updateClient,
} from "./service";
export type { ClientDTO, ClientNoteDTO } from "./dto";
export type { CreateClientInput, ListClientsInput, UpdateClientInput } from "./schemas";
