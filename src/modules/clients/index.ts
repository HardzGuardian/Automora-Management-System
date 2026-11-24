export {
  addClientNote,
  archiveClient,
  createClient,
  deleteClientNote,
  editClientNote,
  getClient,
  listClientNotes,
  listClients,
  loadClient,
  unarchiveClient,
  updateClient,
} from "./service";
export type { ClientDTO, ClientNoteDTO } from "./dto";
export type { CreateClientInput, ListClientsInput, UpdateClientInput } from "./schemas";
