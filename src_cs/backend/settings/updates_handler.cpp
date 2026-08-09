#include "updates_handler.h"

#include <cstdlib>

using json = nlohmann::json;

int handle_update(struct mg_connection *conn, void *)
{
	int exit_code = system("/etc/init.d/update.sh &");
	json res = { { "error", "Update has successfully started! You may continue using suvriddhi OS and wait until the restart in ~10 minutes. Do not turn off the device until it does automatically unless it has been more than 20 minutes, in which case you may turn it off." } };
	SendResponse(conn, res.dump());
	return 200;
}
