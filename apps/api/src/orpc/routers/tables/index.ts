import { list } from './list'
import { columns } from './columns'
import { data } from './data'
import { count } from './count'
import { updateRow, insertRow, deleteRow } from './mutations'
import { schemas } from './schemas'

export const tablesRouter = {
    list,
    columns,
    data,
    count,
    updateRow,
    insertRow,
    deleteRow,
    schemas,
}
